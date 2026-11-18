import { punctuateSpoken } from '@noteapp/extractor';
import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';

import { BYTES_PER_SECOND, type Chunk, createChunker, SAMPLE_RATE } from './chunker';
import { SttError } from './errors';
import { isDownloaded, modelFile, type SttModel } from './models';
import { clearSession, leftover, type SavedChunk, saveChunk, saveSegments } from './session';
import { cutAtGap, keepSpeech } from './speech';
import { cleanSegment, type PreviewSegment, promptFor, settledCount } from './text';
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
  initWhisper(options: {
    filePath: string;
    useGpu?: boolean;
    useFlashAttn?: boolean;
  }): Promise<WhisperContext>;
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

export interface DictationOptions {
  /** 사용자가 자주 쓰는 말(해시태그·카테고리 이름 등). 예시로 줘서 더 맞게 받아써요. */
  words?: string[];
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

// 모델은 한 번 열면 계속 띄워 둬요(여는 데 몇 초 걸려요). 받아쓰기 화면을 열 때 미리 열고
// (prewarmStt), 아무도 안 쓴 채로 IDLE_RELEASE_MS가 지나면 닫아서 메모리를 돌려줘요.
const IDLE_RELEASE_MS = 3 * 60_000;

let loaded: { id: string; context: Promise<WhisperContext> } | null = null;
let users = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function cancelIdleRelease() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function scheduleIdleRelease() {
  cancelIdleRelease();
  if (users > 0 || !loaded) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (users === 0) void releaseStt();
  }, IDLE_RELEASE_MS);
}

/** 받아쓰는 동안 모델을 잡아 둬요. 돌려준 함수를 부르면 놓아요(여러 번 불러도 한 번만). */
function hold(): () => void {
  users++;
  cancelIdleRelease();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    users--;
    scheduleIdleRelease();
  };
}

async function openContext(model: SttModel): Promise<WhisperContext> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initWhisper } = require('whisper.rn/index') as WhisperModule;
  const filePath = modelFile(model).uri;
  // iOS는 GPU(Metal)로 돌아서 flash attention을 켜면 더 빨라요. Android는 whisper.rn이 CPU로만
  // 돌리고, 라이브러리도 GPU가 있을 때만 권해서 꺼 둬요.
  const fast = Platform.OS === 'ios';
  try {
    return await initWhisper({ filePath, useGpu: true, useFlashAttn: fast });
  } catch (e) {
    if (!fast)
      throw new SttError('음성 인식 모델을 열지 못했어요. 모델을 지우고 다시 받아 주세요.', e);
  }
  // 빠른 설정으로 못 여는 기기면 기본 설정으로 다시 열어요.
  try {
    return await initWhisper({ filePath });
  } catch (e) {
    throw new SttError('음성 인식 모델을 열지 못했어요. 모델을 지우고 다시 받아 주세요.', e);
  }
}

/** 모델을 열어요. 이미 열었거나 여는 중이면 그걸 같이 써요(두 번 열지 않아요). */
function contextFor(model: SttModel): Promise<WhisperContext> {
  if (loaded?.id === model.id) return loaded.context;
  const previous = loaded?.context;
  const context = (async () => {
    await previous?.then((c) => c.release()).catch(() => {});
    return openContext(model);
  })();
  const entry = { id: model.id, context };
  loaded = entry;
  context.catch(() => {
    if (loaded === entry) loaded = null; // 다음에 다시 열어 보게 해요
  });
  return context;
}

/**
 * 받아쓰기 화면을 열 때 모델과 말소리 감지를 미리 띄워 둬요. 녹음 버튼을 누르면 바로 받아써요.
 * 안 쓰면 몇 분 뒤 알아서 닫아요. 못 열면 조용히 넘어가고, 녹음할 때 다시 열면서 알려 줘요.
 */
export function prewarmStt(model: SttModel): void {
  if (!isSttAvailable() || !isDownloaded(model)) return;
  contextFor(model).catch(() => {});
  prepareVad();
  scheduleIdleRelease();
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

/** whisper 조각들을 다듬어요. 앞 글(previous)과 같은 문장은 빼요. 끝 시각은 받은 소리 안으로 맞춰요. */
function previewSegments(
  result: WhisperResult,
  windowMs: number,
  previous?: string,
): PreviewSegment[] {
  const out: PreviewSegment[] = [];
  for (const s of result.segments) {
    const text = cleanSegment(s.text, out[out.length - 1]?.text ?? previous);
    // whisper.cpp 시간 단위는 10ms예요.
    if (text) out.push({ text, endMs: Math.min(s.t1 * 10, windowMs) });
  }
  return out;
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
function createTranscriber(
  context: Promise<WhisperContext>,
  segments: SttSegment[],
  words: string[] = [],
) {
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
      prompt: promptFor(
        segments.map((s) => s.text),
        words,
      ),
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
     * before: 이 소리 바로 앞에서 미리 받아써서 고정한 글. 받아쓴 글 끝과 같이 예시로 줘요.
     * 받아쓸 조각이 있거나 이미 돌고 있으면 null이에요.
     */
    async preview(pcm: Uint8Array, before: string[]): Promise<PreviewSegment[] | null> {
      if (queued > done || cancelled || previewJob) return null;
      const ctx = await context;
      if (queued > done || cancelled || previewJob) return null;
      try {
        const previous = [...segments.map((s) => s.text), ...before];
        const job = ctx.transcribeData(toArrayBuffer(pcm), {
          language: 'ko',
          prompt: promptFor(previous, words),
        });
        previewJob = job;
        previewDone = job.promise.catch(() => {});
        const result = await job.promise;
        if (result.isAborted || cancelled) return null;
        const windowMs = (pcm.length / BYTES_PER_SECOND) * 1000;
        return previewSegments(result, windowMs, previous[previous.length - 1]);
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
export async function startDictation(
  model: SttModel,
  options: DictationOptions = {},
): Promise<Dictation> {
  ensureAvailable();
  if (!isDownloaded(model)) throw new SttError('먼저 음성 인식 모델을 받아 주세요.');
  const release = hold();
  try {
    await askMicrophone();
  } catch (e) {
    release();
    throw e;
  }
  clearSession(); // 이어서 받아쓸 녹음이 있으면 화면에서 먼저 물어봐요.
  // 화면에서 미리 열어 뒀으면 그걸 써요. 아니면 녹음하는 동안 열어요.
  const contextReady = contextFor(model);
  contextReady.catch(() => {});
  prepareVad();

  const segments: SttSegment[] = [];
  const transcriber = createTranscriber(contextReady, segments, options.words);
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
  // 두 번 연속 똑같이 나온 앞 문장은 고정하고(settledCount), 다음부터는 그 뒤 소리만 받아써요.
  // 그래서 글이 덜 바뀌고, 받아쓸 소리가 짧아져서 폰이 덜 일해요.
  let preview = emptyPreview(0);
  void (async () => {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, PREVIEW_EVERY_MS));
      const base = chunker.emittedBytes();
      // 새 조각이 나갔으면 그 조각이 받아써서 partial에 들어가요. 미리 받아쓰기는 처음부터 다시예요.
      if (base !== preview.base) preview = emptyPreview(base);
      const window = chunker.pendingPcm().subarray(preview.frozenBytes);
      if (stopped || window.length < BYTES_PER_SECOND) continue;
      const at = preview;
      const found = await transcriber.preview(window, at.frozen);
      if (found === null || stopped) continue;
      preview = advancePreview(at, found, (window.length / BYTES_PER_SECOND) * 1000);
    }
  })();

  return {
    seconds: () => Math.floor(total / BYTES_PER_SECOND),
    partial: () => resultOf(segments, 0).text,
    // 이 말이 든 조각을 받아쓰고 나면 partial에 들어가서 여기서는 빼요.
    preview: () => (preview.base >= confirmed ? previewText(preview) : ''),
    backlog: () => transcriber.backlog(),
    async cancel() {
      await stop();
      await transcriber.cancel();
      clearSession();
      release();
    },
    async finish(onProgress) {
      await stop();
      try {
        if (total < BYTES_PER_SECOND / 2) {
          await transcriber.cancel();
          clearSession();
          throw new SttError('녹음이 너무 짧아요. 다시 말해 주세요.');
        }
        chunker.flush();
        await transcriber.idle(onProgress);
        clearSession();
        return resultOf(segments, Math.round((total / BYTES_PER_SECOND) * 1000));
      } finally {
        release();
      }
    },
  };
}

/** 미리 받아쓰기 상태. base: 이 소리가 시작하는 곳(지금까지 조각으로 넘긴 바이트) */
interface PreviewState {
  base: number;
  /** 고정한 문장들. 다시 받아쓰지 않아요. */
  frozen: string[];
  /** 고정한 문장이 끝나는 곳(base부터 바이트). 다음엔 여기부터 받아써요. */
  frozenBytes: number;
  /** 지난번에 고정 안 된 문장들(frozenBytes부터 ms). 다음 결과와 비교해요. */
  last: PreviewSegment[];
}

const emptyPreview = (base: number): PreviewState => ({
  base,
  frozen: [],
  frozenBytes: 0,
  last: [],
});

const previewText = (p: PreviewState) => [...p.frozen, ...p.last.map((s) => s.text)].join(' ');

function advancePreview(at: PreviewState, found: PreviewSegment[], windowMs: number): PreviewState {
  const n = settledCount(at.last, found, windowMs);
  if (n === 0) return { ...at, last: found };
  const endMs = found[n - 1]!.endMs;
  // 16비트라 2바이트 단위로 잘라요.
  const bytes = Math.floor(((endMs / 1000) * BYTES_PER_SECOND) / 2) * 2;
  return {
    base: at.base,
    frozen: [...at.frozen, ...found.slice(0, n).map((s) => s.text)],
    frozenBytes: at.frozenBytes + bytes,
    last: found.slice(n).map((s) => ({ text: s.text, endMs: Math.max(0, s.endMs - endMs) })),
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
  options: DictationOptions = {},
): Promise<SttResult> {
  ensureAvailable();
  if (!isDownloaded(model)) throw new SttError('먼저 음성 인식 모델을 받아 주세요.');
  const left = leftover();
  if (!left) throw new SttError('이어서 받아쓸 녹음이 없어요.');
  const durationMs = (leftoverSeconds() ?? 0) * 1000;
  const release = hold();
  try {
    const transcriber = createTranscriber(contextFor(model), left.segments, options.words);
    for (const chunk of left.chunks) transcriber.add(Promise.resolve(chunk));
    await transcriber.idle(onProgress);
    clearSession();
    return resultOf(left.segments, durationMs);
  } finally {
    release();
  }
}

/** 다 못 받아쓴 녹음을 버려요. */
export const discardLeftover = clearSession;

/** 열어 둔 모델을 닫아요(메모리 정리). 모델을 지우기 전에 불러요. */
export async function releaseStt(): Promise<void> {
  cancelIdleRelease();
  await releaseVad();
  const context = loaded?.context;
  loaded = null;
  await context?.then((c) => c.release()).catch(() => {});
}
