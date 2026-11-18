import { File, Paths } from 'expo-file-system';

import { SttError } from './errors';
import { packDir, type SttModel } from './models';
import { wavHeader } from './recordings';
import { sherpa } from './sherpa';

// SenseVoice 받아쓰기(sherpa-onnx, @siteed/sherpa-onnx.rn). (담당: B)
// whisper처럼 한 글자씩 이어 만들지 않고 한 번에 통째로 받아써서 훨씬 빨라요(SpokenLog 참고).
// 엔진(engine.ts)이 whisper와 똑같이 쓰게, whisper.rn 컨텍스트와 같은 모양(transcribeData, release)으로 감쌌어요.
// - 예시 문장(prompt)·beam search는 없어서 무시해요. 내 단어 예시도 못 써요.
// - 문장마다 시각을 안 줘서, 조각 하나를 한 덩어리(조각 시작~끝)로 돌려줘요.
// 네이티브 모듈이라 쓸 때 불러와요(sherpa.ts).

interface AsrResult {
  success: boolean;
  text?: string;
  error?: string;
}
interface SherpaAsr {
  initialize(config: {
    modelDir: string;
    modelType: 'sense_voice';
    modelFiles: { model: string; tokens: string };
    language?: string;
    useItn?: boolean;
    numThreads?: number;
  }): Promise<{ success: boolean; error?: string }>;
  recognizeFromFile(filePath: string): Promise<AsrResult>;
  release(): Promise<unknown>;
}

const asr = () => (sherpa() as { ASR: SherpaAsr }).ASR;

/** whisper.rn 결과와 같은 모양 */
interface Result {
  result: string;
  segments: { text: string; t0: number; t1: number }[];
  isAborted: boolean;
}

export interface SenseVoiceContext {
  transcribeData(
    pcm: ArrayBuffer,
    options: unknown,
  ): { stop(): Promise<void>; promise: Promise<Result> };
  release(): Promise<void>;
}

/** SenseVoice가 붙이는 꼬리표(<|ko|><|NEUTRAL|> 같은 것)를 지워요. */
export const stripTags = (text: string) =>
  text
    .replace(/<\|[^|]*\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function openSenseVoice(model: SttModel): Promise<SenseVoiceContext> {
  const init = await asr().initialize({
    modelDir: packDir(model).uri,
    modelType: 'sense_voice',
    modelFiles: { model: model.files[0]!.name, tokens: model.files[1]!.name },
    language: 'ko',
    useItn: true,
    numThreads: 4,
  });
  if (!init.success) throw new SttError(init.error ?? 'SenseVoice 모델을 열지 못했어요.');

  // 한 번에 하나씩 받아써요.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    transcribeData(pcm) {
      let aborted = false;
      const promise = queue.then(async (): Promise<Result> => {
        if (aborted) return { result: '', segments: [], isAborted: true };
        const file = new File(Paths.cache, `stt-sensevoice-${Date.now()}.wav`);
        try {
          const bytes = new Uint8Array(pcm);
          const wav = new Uint8Array(44 + bytes.length);
          wav.set(wavHeader(bytes.length), 0);
          wav.set(bytes, 44);
          if (file.exists) file.delete();
          file.create();
          file.write(wav);
          const answer = await asr().recognizeFromFile(file.uri);
          if (!answer.success)
            throw new SttError(answer.error ?? 'SenseVoice로 받아쓰지 못했어요.');
          const text = stripTags(answer.text ?? '');
          // whisper.cpp처럼 10ms 단위예요. 16비트 16kHz라 1ms = 32바이트
          const t1 = Math.round(bytes.length / 32 / 10);
          return { result: text, segments: text ? [{ text, t0: 0, t1 }] : [], isAborted: aborted };
        } finally {
          if (file.exists) file.delete();
        }
      });
      queue = promise.catch(() => {});
      return {
        stop: async () => {
          aborted = true;
        },
        promise,
      };
    },
    async release() {
      await asr()
        .release()
        .catch(() => {});
    },
  };
}
