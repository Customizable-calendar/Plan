import { punctuateSpoken } from '@noteapp/extractor';
import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';

import { BYTES_PER_SECOND, createChunker, SAMPLE_RATE } from './chunker';
import { SttError } from './errors';
import { isDownloaded, modelFile, type SttModel } from './models';
import { clearSession, leftover, type SavedChunk, saveChunk, saveSegments } from './session';

// 기기 안에서 받아써요(whisper.rn = whisper.cpp). 소리는 기기 밖으로 나가지 않아요.
// 네이티브 모듈이라 Expo Go에는 없어요. 개발 빌드(EAS)에서만 돌아요.
// 그래서 라이브러리는 쓸 때 불러오고(require), 없으면 isSttAvailable()이 false예요.

/**
 * whisper에 먼저 들려주는 예시 문장. 부호가 찍힌 문장을 보여 주면 받아쓴 글에도 마침표·물음표를
 * 찍고 문장을 나눠요. 자주 나오는 팀 이름·말도 같이 넣어서 맞게 받아쓰게 해요.
 */
const PROMPT =
  '안녕하세요. 오늘 회의를 시작하겠습니다. 민성, 준호, 재민, 서현이 참석했어요. ' +
  '다음 주 화요일 오후 2시에 디자인 리뷰를 해요. 금요일까지 발표 자료를 만들어 주세요. 질문 있나요?';

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
    options: { language: string; prompt?: string; onProgress?: (percent: number) => void },
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
  /** 녹음은 됐지만 아직 못 받아쓴 조각 수 */
  backlog(): number;
  /** 녹음을 끝내고 남은 조각을 받아써요. onProgress는 0~1 */
  finish(onProgress?: (ratio: number) => void): Promise<SttResult>;
  /** 녹음을 버려요 */
  cancel(): Promise<void>;
}

export function isSttAvailable(): boolean {
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

/** 조용할 때 whisper가 자주 지어내는 말. 예시 문장(PROMPT)이 그대로 나온 것도 빼요. */
const PROMPT_SENTENCES = PROMPT.split(/(?<=[.?])\s+/).filter((t) => t.length >= 15);
const isMadeUp = (text: string) =>
  /시청해\s?주셔서\s?감사합니다|구독과\s?좋아요|자막\s?제공/.test(text) ||
  PROMPT_SENTENCES.includes(text);

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
  let queued = 0;
  let done = 0;
  let inChunk = 0; // 지금 조각 진행 0~1
  let failure: unknown = null;
  let cancelled = false;
  let running: { stop(): Promise<void> } | null = null;

  const run = async (saved: Promise<SavedChunk>) => {
    const chunk = await saved;
    const bytes = await chunk.file.bytes();
    const pcm = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const job = (await context).transcribeData(pcm, {
      language: 'ko',
      prompt: PROMPT,
      onProgress: (p) => (inChunk = p / 100),
    });
    running = job;
    const result = await job.promise;
    running = null;
    if (result.isAborted || cancelled) return;
    for (const s of result.segments) {
      const text = s.text.trim();
      // whisper.cpp 시간 단위는 10ms예요.
      if (text && !isMadeUp(text))
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
    add(saved: Promise<SavedChunk>) {
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
        }
      });
    },
    backlog: () => queued - done,
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
      await running?.stop().catch(() => {});
      await chain;
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

  const segments: SttSegment[] = [];
  const transcriber = createTranscriber(contextReady, segments);
  const chunker = createChunker((chunk) => {
    // 말이 없는 조각은 받아쓰지 않아요(없는 말을 지어내지 않게).
    if (!chunk.silent) transcriber.add(saveChunk(chunk.offsetMs, chunk.pcm));
  });

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

  return {
    seconds: () => Math.floor(total / BYTES_PER_SECOND),
    partial: () => resultOf(segments, 0).text,
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
  if (!loaded) return;
  await loaded.context.release();
  loaded = null;
}
