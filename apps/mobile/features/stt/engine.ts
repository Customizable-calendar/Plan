import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';

import { SttError } from './errors';
import { isDownloaded, modelFile, type SttModel } from './models';

// 기기 안에서 받아써요(whisper.rn = whisper.cpp). 소리는 기기 밖으로 나가지 않아요.
// 네이티브 모듈이라 Expo Go에는 없어요. 개발 빌드(EAS)에서만 돌아요.
// 그래서 라이브러리는 쓸 때 불러오고(require), 없으면 isSttAvailable()이 false예요.

/** 녹음 형식: whisper가 받는 16kHz, 모노, 16비트 PCM */
const SAMPLE_RATE = 16_000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
/** 한 번에 받아쓸 최대 길이. 메모리에 소리를 모아서 10분(약 19MB)으로 막아요. */
export const MAX_SECONDS = 10 * 60;

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
    options: { language: string; onProgress?: (percent: number) => void },
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
  /** 녹음을 끝내고 받아써요. onProgress는 0~1 */
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

function join(chunks: Uint8Array[], total: number): ArrayBuffer {
  const out = new Uint8Array(total - (total % 2)); // 16비트라 짝수 바이트만
  let offset = 0;
  for (const chunk of chunks) {
    const n = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, n), offset);
    offset += n;
  }
  return out.buffer;
}

/** 녹음을 시작해요. 끝낼 때 finish()로 받아써요. */
export async function startDictation(model: SttModel): Promise<Dictation> {
  ensureAvailable();
  if (!isDownloaded(model)) throw new SttError('먼저 음성 인식 모델을 받아 주세요.');
  await askMicrophone();
  // 모델은 녹음하는 동안 미리 열어 둬요.
  const contextReady = contextFor(model);
  contextReady.catch(() => {});

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const audio = require('@fugood/react-native-audio-pcm-stream').default as LiveAudioStream;
  const chunks: Uint8Array[] = [];
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
    chunks.push(bytes);
    total += bytes.length;
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
    async cancel() {
      await stop();
      chunks.length = 0;
    },
    async finish(onProgress) {
      await stop();
      if (total < BYTES_PER_SECOND / 2) throw new SttError('녹음이 너무 짧아요. 다시 말해 주세요.');
      const durationMs = Math.round((total / BYTES_PER_SECOND) * 1000);
      const pcm = join(chunks, total);
      chunks.length = 0;
      const context = await contextReady;
      try {
        const { promise } = context.transcribeData(pcm, {
          language: 'ko',
          onProgress: (p) => onProgress?.(p / 100),
        });
        const result = await promise;
        if (result.isAborted) throw new SttError('받아쓰기를 멈췄어요.');
        return {
          text: result.result.trim(),
          // whisper.cpp 시간 단위는 10ms예요.
          segments: result.segments.map((s) => ({
            text: s.text.trim(),
            startMs: s.t0 * 10,
            endMs: s.t1 * 10,
          })),
          durationMs,
        };
      } catch (e) {
        if (e instanceof SttError) throw e;
        throw new SttError('받아쓰지 못했어요. 다시 해 주세요.', e);
      }
    },
  };
}

/** 열어 둔 모델을 닫아요(메모리 정리). 모델을 지우기 전에 불러요. */
export async function releaseStt(): Promise<void> {
  if (!loaded) return;
  await loaded.context.release();
  loaded = null;
}
