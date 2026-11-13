import { punctuateSpoken } from '@noteapp/extractor';
import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';

import { BYTES_PER_SECOND, type Chunk, createChunker, SAMPLE_RATE } from './chunker';
import { SttError } from './errors';
import { isDownloaded, modelFile, type SttModel } from './models';
import { clearSession, leftover, type SavedChunk, saveChunk, saveSegments } from './session';
import { cutAtGap, keepSpeech } from './speech';
import { cleanSegment, promptFor } from './text';
import { prepareVad, releaseVad, speechIn } from './vad';

// 기기 안에서 받아써요(whisper.rn = whisper.cpp). 소리는 기기 밖으로 나가지 않아요.
// 네이티브 모듈이라 Expo Go에는 없어요. 개발 빌드(EAS)에서만 돌아요.
// 그래서 라이브러리는 쓸 때 불러오고(require), 없으면 isSttAvailable()이 false예요.

/** 밀린 조각이 이만큼 이하면 후보 여러 개를 비교해서(beam search) 더 정확하게 받아써요. */
const BEAM_BACKLOG = 1;
const BEAM_SIZE = 5;
/** 미리 받아쓰기(회색 글) 사이에 쉬는 시간. 폰이 쉴 틈을 줘요. */
const PREVIEW_EVERY_MS = 1500;

/**
 * 한 번에 녹음할 수 있는 최대 길이. 녹음 형식은 whisper가 받는 16kHz 모노 16비트 PCM이에요.
 * 20~30초 조각마다 받아써서 메모리는 조각 하나(약 1MB)만큼만 써요.
 */
export const MAX_SECONDS = 3 * 60 * 60;

interface LiveAudioStream {
  init(options: {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource?: number;
    bufferSize?: number;
    wavFile: string;
  }): void;
  start(): void;
  stop(): Promise<void> | void;
  on(event: 'data', callback: (base64: string) => void): { remove(): void } | void;
}

// whisper.rn에서 쓰는 것만 적었어요(0.7.4). 라이브러리 타입을 그대로 불러오면
// 'react-native' 조건 때문에 라이브러리 src까지 타입 검사해서 오류가 나요.
interface WhisperResult {
  result: string;
  segments: { text: string; t0: number; t1: number }[];
  isAborted: boolean;
}
interface WhisperContext {
  transcribeData(
    pcm: ArrayBuffer,
    options: {
      language: string;
      prompt?: string;
      beamSize?: number;
      bestOf?: number;
      onProgress?: (percent: number) => void;
    },
  ): { stop(): Promise<void>; promise: Promise<WhisperResult> };
  release(): Promise<void>;
}
interface WhisperModule {
  initWhisper(options: { filePath: string }): Promise<WhisperContext>;
}

export interface SttSegment {
  text: string;
  /** 녹음 시작부터 ms */
  startMs: number;
  endMs: number;
}

export interface SttResult {
  text: string;
  segments: SttSegment[];
  durationMs: number;
}

export interface Dictation {
  /** 녹음한 길이(초) */
  seconds(): number;
  /** 지금까지 받아쓴 글. 말하는 동안 조각(20~30초)마다 늘어나요. */
  partial(): string;
  /** 아직 조각이 안 된 말을 미리 받아쓴 글. 조각을 받아쓰면 partial로 넘어가요. */
  preview(): string;
  /** 녹음은 됐지만 아직 못 받아쓴 조각 수 */
  backlog(): number;
  /** 녹음을 끝내고 남은 조각을 받아써요. onProgress는 0~1 */
  finish(onProgress?: (ratio: number) => void): Promise<SttResult>;
  /** 녹음을 버려요 */
  cancel(): Promise<void>;
}

export function isSttAvailable(): boolean {
  if (Platform.OS === 'web') return false; // 웹(아이폰 stage 링크)에는 기기 안 음성 인식이 없어요.
  return TurboModuleRegistry.get('RNWhisper') != null && NativeModules.RNLiveAudioStream != null;
}

function ensureAvailable() {
  if (!isSttAvailable())
    throw new SttError('받아쓰기는 개발 빌드에서만 돼요. Expo Go에는 음성 인식 모듈이 없어요.');
}

let loaded: { id: string; context: WhisperContext } | null = null;

async function contextFor(model: SttModel): Promise<WhisperContext> {
  if (loaded?.id === model.id) return loaded.context;
  if (loaded) {
    await loaded.context.release();
    loaded = null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initWhisper } = require('whisper.rn/index') as WhisperModule;
  try {
    const context = await initWhisper({ filePath: modelFile(model).uri });
    loaded = { id: model.id, context };
    return context;
  } catch (e) {
    throw new SttError('음성 인식 모델을 열지 못했어요. 모델을 지우고 다시 받아 주세요.', e);
  }
}

async function askMicrophone() {
  if (Platform.OS !== 'android') return; // iOS는 녹음을 시작할 때 시스템이 물어봐요(app.json 문구).
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (result !== PermissionsAndroid.RESULTS.GRANTED)
    throw new SttError('마이크 권한이 없어요. 설정에서 마이크를 허용해 주세요.');
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** whisper 조각들을 다듬어서 붙여요. 앞 글(previous)과 같은 문장은 빼요. */
function cleanTexts(result: WhisperResult, previous?: string): string[] {
  const texts: string[] = [];
  for (const s of result.segments) {
    const text = cleanSegment(s.text, texts[texts.length - 1] ?? previous);
    if (text) texts.push(text);
  }
  return texts;
}

/**
 * 조각을 말소리만 남게 다듬어요(VAD). 말소리가 없으면 null이라 받아쓰지 않아요.
 * VAD를 못 쓰면 소리 크기로 본 결과(silent)를 따라요.
 */
async function speechOnly(chunk: Chunk): Promise<{ pcm: Uint8Array; offsetMs: number } | null> {
  const spans = await speechIn(chunk.pcm);
  if (spans === null) return chunk.silent ? null : chunk;
  return keepSpeech(chunk.pcm, chunk.offsetMs, spans);
}

/** 30초가 되도록 쉬는 곳이 없을 때 말소리 감지로 말이 끊기지 않는 곳을 찾아요. */
async function findGap(pcm: Uint8Array, minBytes: number): Promise<number | null> {
  const spans = await speechIn(pcm);
  return spans === null ? null : cutAtGap(spans, pcm.length, minBytes);
}

function resultOf(segments: SttSegment[], durationMs: number): SttResult {
  return {
    // 부호가 빠진 곳에 마침표·물음표를 찍고 문장마다 줄을 나눠요. 카드도 이 글에서 찾아요.
    text: punctuateSpoken(segments.map((s) => s.text).join(' ')),
    segments,
    durationMs,
  };
}

/**
 * 조각을 하나씩 차례로 받아써요. 녹음하는 동안에도 뒤에서 계속 돌아요.
 * 받아쓴 조각은 글을 기기에 적고 소리 파일을 지워요.
 */
function createTranscriber(context: Promise<WhisperContext>, segments: SttSegment[]) {
  let chain: Promise<void> = Promise.resolve();
  // 미리 받아쓰기는 조각이 없을 때만 돌고, 조각이 오면 멈춰요(모델 하나를 같이 써요).
  let previewJob: { stop(): Promise<void> } | null = null;
  let previewDone: Promise<unknown> = Promise.resolve();
  let queued = 0;
  let done = 0;
  let inChunk = 0; // 지금 조각 진행 0~1
  let failure: unknown = null;
  let cancelled = false;
  let running: { stop(): Promise<void> } | null = null;

  const run = async (saved: Promise<SavedChunk | null>) => {
    const chunk = await saved;
    if (!chunk) return; // 말소리가 없는 조각
    const bytes = await chunk.file.bytes();
    await previewJob?.stop().catch(() => {});
    await previewDone;
    // 밀린 게 적으면 후보 여러 개를 비교해서 더 정확하게, 많으면 빠르게 받아써요.
    const careful = queued - done <= BEAM_BACKLOG;
    const job = (await context).transcribeData(toArrayBuffer(bytes), {
      language: 'ko',
      // 앞에서 받아쓴 글 끝을 같이 줘서 조각이 바뀌어도 말이 이어지게 해요.
      prompt: promptFor(segments.map((s) => s.text)),
      ...(careful ? { beamSize: BEAM_SIZE } : { bestOf: 2 }),
      onProgress: (p) => (inChunk = p / 100),
    });
    running = job;
    const result = await job.promise;
    running = null;
    if (result.isAborted || cancelled) return;
    let previous = segments[segments.length - 1]?.text;
    for (const s of result.segments) {
      const text = cleanSegment(s.text, previous);
      if (!text) continue;
      previous = text;
      // whisper.cpp 시간 단위는 10ms예요.
      segments.push({
        text,
        startMs: chunk.offsetMs + s.t0 * 10,
        endMs: chunk.offsetMs + s.t1 * 10,
      });
    }
    await saveSegments(segments);
    chunk.file.delete();
  };

  const progress = () => (queued === 0 ? 1 : Math.min(1, (done + inChunk) / queued));

  return {
    /** onDone: 이 조각을 다 받아쓰면(건너뛰어도) 불러요. */
    add(saved: Promise<SavedChunk | null>, onDone?: () => void) {
      queued++;
      saved.catch(() => {});
      chain = chain.then(async () => {
        if (failure || cancelled) return;
        inChunk = 0;
        try {
          await run(saved);
        } catch (e) {
          failure = e;
        } finally {
          done++;
          onDone?.();
        }
      });
    },
    backlog: () => queued - done,
    /**
     * 아직 조각이 안 된 소리를 빠르게(후보 하나로) 받아써 봐요. 기기에 적지 않아요.
     * 받아쓸 조각이 있거나 이미 돌고 있으면 null이에요.
     */
    async preview(pcm: Uint8Array): Promise<string | null> {
      if (queued > done || cancelled || previewJob) return null;
      const ctx = await context;
      if (queued > done || cancelled || previewJob) return null;
      try {
        const job = ctx.transcribeData(toArrayBuffer(pcm), {
          language: 'ko',
          prompt: promptFor(segments.map((s) => s.text)),
        });
        previewJob = job;
        previewDone = job.promise.catch(() => {});
        const result = await job.promise;
        if (result.isAborted || cancelled) return null;
        return cleanTexts(result, segments[segments.length - 1]?.text).join(' ');
      } catch {
        return null;
      } finally {
        previewJob = null;
      }
    },
    /** 넣은 조각을 다 받아쓸 때까지 기다려요. 실패했으면 던져요. */
    async idle(onProgress?: (ratio: number) => void) {
      const timer = onProgress ? setInterval(() => onProgress(progress()), 300) : null;
      try {
        await chain;
      } finally {
        if (timer) clearInterval(timer);
      }
      if (failure) {
        if (failure instanceof SttError) throw failure;
        throw new SttError(
          '받아쓰지 못했어요. 남은 녹음은 다음에 이어서 받아쓸 수 있어요.',
          failure,
        );
      }
    },
    async cancel() {
      cancelled = true;
      await previewJob?.stop().catch(() => {});
      await running?.stop().catch(() => {});
      await chain;
      await previewDone;
    },
  };
}

/** 녹음을 시작해요. 말하는 동안 조각마다 받아쓰고, 끝낼 때 finish()로 남은 걸 받아써요. */
export async function startDictation(model: SttModel): Promise<Dictation> {
  ensureAvailable();
  if (!isDownloaded(model)) throw new SttError('먼저 음성 인식 모델을 받아 주세요.');
  await askMicrophone();
  clearSession(); // 이어서 받아쓸 녹음이 있으면 화면에서 먼저 물어봐요.
  // 모델은 녹음하는 동안 미리 열어 둬요.
  const contextReady = contextFor(model);
  contextReady.catch(() => {});
  prepareVad();

  const segments: SttSegment[] = [];
  const transcriber = createTranscriber(contextReady, segments);
  /** 여기(바이트)까지는 조각으로 받아써서 partial에 들어갔어요. */
  let confirmed = 0;
  const chunker = createChunker((chunk) => {
    const end = Math.round((chunk.offsetMs / 1000) * BYTES_PER_SECOND) + chunk.pcm.length;
    // 말이 없는 조각은 받아쓰지 않아요(없는 말을 지어내지 않게).
    const saved = speechOnly(chunk).then((kept) =>
      kept ? saveChunk(kept.offsetMs, kept.pcm) : null,
    );
    transcriber.add(saved, () => (confirmed = Math.max(confirmed, end)));
  }, findGap);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const audio = require('@fugood/react-native-audio-pcm-stream').default as LiveAudioStream;
  let total = 0;
  let stopped = false;

  audio.init({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 6, // Android VOICE_RECOGNITION
    bufferSize: 4096,
    wavFile: '',
  });
  const subscription = audio.on('data', (base64) => {
    if (stopped || total >= MAX_SECONDS * BYTES_PER_SECOND) return;
    const bytes = decodeBase64(base64);
    total += bytes.length;
    chunker.push(bytes);
  });
  audio.start();

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await audio.stop();
    subscription?.remove();
  };

  // 말하는 동안 아직 조각이 안 된 말을 계속 미리 받아써요(회색 글).
  // 조각을 받아쓰는 동안에는 쉬어요. 조각이 먼저예요.
  let preview = { text: '', from: 0 };
  void (async () => {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, PREVIEW_EVERY_MS));
      const pending = chunker.pendingPcm();
      if (stopped || pending.length < BYTES_PER_SECOND) continue;
      const from = chunker.emittedBytes();
      const text = await transcriber.preview(pending);
      if (text !== null && !stopped) preview = { text, from };
    }
  })();

  return {
    seconds: () => Math.floor(total / BYTES_PER_SECOND),
    partial: () => resultOf(segments, 0).text,
    // 이 말이 든 조각을 받아쓰고 나면 partial에 들어가서 여기서는 빼요.
    preview: () => (preview.from >= confirmed ? preview.text : ''),
    backlog: () => transcriber.backlog(),
    async cancel() {
      await stop();
      await transcriber.cancel();
      clearSession();
    },
    async finish(onProgress) {
      await stop();
      if (total < BYTES_PER_SECOND / 2) {
        await transcriber.cancel();
        clearSession();
        throw new SttError('녹음이 너무 짧아요. 다시 말해 주세요.');
      }
      chunker.flush();
      await transcriber.idle(onProgress);
      clearSession();
      return resultOf(segments, Math.round((total / BYTES_PER_SECOND) * 1000));
    },
  };
}

/** 앱이 꺼져서 다 못 받아쓴 녹음이 있으면 그 길이(초), 없으면 null */
export function leftoverSeconds(): number | null {
  const left = leftover();
  if (!left) return null;
  const ends = [
    ...left.segments.map((s) => s.endMs),
    ...left.chunks.map((c) => c.offsetMs + (c.file.size / BYTES_PER_SECOND) * 1000),
  ];
  return Math.round(Math.max(0, ...ends) / 1000);
}

/** 다 못 받아쓴 녹음을 이어서 받아써요. */
export async function resumeLeftover(
  model: SttModel,
  onProgress?: (ratio: number) => void,
): Promise<SttResult> {
  ensureAvailable();
  if (!isDownloaded(model)) throw new SttError('먼저 음성 인식 모델을 받아 주세요.');
  const left = leftover();
  if (!left) throw new SttError('이어서 받아쓸 녹음이 없어요.');
  const durationMs = (leftoverSeconds() ?? 0) * 1000;
  const transcriber = createTranscriber(contextFor(model), left.segments);
  for (const chunk of left.chunks) transcriber.add(Promise.resolve(chunk));
  await transcriber.idle(onProgress);
  clearSession();
  return resultOf(left.segments, durationMs);
}

/** 다 못 받아쓴 녹음을 버려요. */
export const discardLeftover = clearSession;

/** 열어 둔 모델을 닫아요(메모리 정리). 모델을 지우기 전에 불러요. */
export async function releaseStt(): Promise<void> {
  await releaseVad();
  if (!loaded) return;
  await loaded.context.release();
  loaded = null;
}
