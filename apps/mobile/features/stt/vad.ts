import { ensureVadModel } from './models';
import type { Span } from './speech';

// 말소리 감지(VAD, whisper.rn 안의 Silero). 소리 크기 대신 "사람 말인지"를 봐요.
// 에어컨·키보드 같은 잡음을 말로 잘못 보지 않아서 없는 말을 덜 지어내요.
// 모델을 못 받았거나 열지 못하면 null을 돌려주고, 그때는 소리 크기만 보고 잘라요.

interface VadContext {
  detectSpeechData(
    pcm: ArrayBuffer,
    options: {
      threshold?: number;
      minSpeechDurationMs?: number;
      minSilenceDurationMs?: number;
      maxSpeechDurationS?: number;
      speechPadMs?: number;
    },
  ): Promise<{ t0: number; t1: number }[]>;
  release(): Promise<void>;
}
interface VadModule {
  initWhisperVad(options: { filePath: string; useGpu?: boolean }): Promise<VadContext>;
}

// 작은 말소리도 놓치지 않게 기본값(0.5)보다 조금 낮게 둬요.
const OPTIONS = {
  threshold: 0.4,
  minSpeechDurationMs: 200,
  minSilenceDurationMs: 150,
  maxSpeechDurationS: 30,
  speechPadMs: 100,
};

let opening: Promise<VadContext | null> | null = null;
// whisper.rn의 VAD 컨텍스트는 내부 ggml 스케줄러가 스레드 안전하지 않아서,
// detectSpeechData가 동시에 두 번 돌면 WSP_GGML_ASSERT(!sched->is_alloc)로 앱이 꺼져요.
// 그래서 열고 감지하고 닫는 일을 한 줄로 차례대로 돌려요.
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

function open(): Promise<VadContext | null> {
  opening ??= (async () => {
    try {
      const file = await ensureVadModel();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initWhisperVad } = require('whisper.rn/index') as VadModule;
      return await initWhisperVad({ filePath: file.uri, useGpu: false });
    } catch {
      opening = null; // 다음 녹음에서 다시 해 봐요.
      return null;
    }
  })();
  return opening;
}

/** 녹음을 시작할 때 미리 열어 둬요. */
export function prepareVad(): void {
  void serialized(async () => {
    await open();
  });
}

/** 말소리가 있는 곳(ms). VAD를 못 쓰면 null이에요. */
export function speechIn(pcm: Uint8Array): Promise<Span[] | null> {
  if (pcm.length < 2) return Promise.resolve(null);
  return serialized(async () => {
    const vad = await open();
    if (!vad) return null;
    try {
      const buffer = pcm.buffer.slice(
        pcm.byteOffset,
        pcm.byteOffset + pcm.byteLength,
      ) as ArrayBuffer;
      const found = await vad.detectSpeechData(buffer, OPTIONS);
      // whisper.cpp VAD 시간 단위는 10ms예요.
      return found.map((s) => ({ startMs: Math.round(s.t0 * 10), endMs: Math.round(s.t1 * 10) }));
    } catch {
      return null;
    }
  });
}

export function releaseVad(): Promise<void> {
  return serialized(async () => {
    const pending = opening;
    opening = null;
    const vad = await pending;
    await vad?.release().catch(() => {});
  });
}
