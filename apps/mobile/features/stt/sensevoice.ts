import { File, Paths } from 'expo-file-system';

import { SttError } from './errors';
import { packDir, type SttModel } from './models';
import { wavHeader } from './recordings';
import { sherpa } from './sherpa';

// sherpa-onnx 받아쓰기(@siteed/sherpa-onnx.rn): SenseVoice, Qwen3-ASR. (담당: B)
// 엔진(engine.ts)이 whisper와 똑같이 쓰게, whisper.rn 컨텍스트와 같은 모양(transcribeData, release)으로 감쌌어요.
// - SenseVoice: 한 번에 통째로 받아써서 아주 빨라요(SpokenLog 참고). 내 단어 예시는 못 써요.
// - Qwen3-ASR 0.6B: 로컬 모델 중 한국어가 제일 정확해요(LocalSTT 벤치마크: 1.7B CER 5.6%, Whisper turbo 7.8%).
//   내 단어는 hotwords로 줘요. 한 번에 28초까지 넣어서(LocalSTT와 같아요) 긴 조각은 나눠서 받아써요.
// - 둘 다 문장마다 시각을 안 줘서, 조각(또는 나눈 조각) 하나를 한 덩어리로 돌려줘요.
// - sherpa-onnx는 받아쓰기 모델을 한 번에 하나만 띄워요.
// 네이티브 모듈이라 쓸 때 불러와요(sherpa.ts).

interface AsrResult {
  success: boolean;
  text?: string;
  error?: string;
}
interface SherpaAsr {
  initialize(config: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;
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

export interface SherpaContext {
  transcribeData(
    pcm: ArrayBuffer,
    options: unknown,
  ): { stop(): Promise<void>; promise: Promise<Result> };
  release(): Promise<void>;
}

/** 모델이 붙이는 꼬리표(<|ko|><|NEUTRAL|>, language Korean<asr_text> 같은 것)를 지워요. */
export const stripTags = (text: string) =>
  text
    .replace(/<\|[^|]*\|>/g, ' ')
    .replace(/^\s*language\s+\w+\s*/i, '')
    .replace(/<\/?asr_text>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** 16비트 16kHz라 1초 = 32000바이트 */
const BYTES_PER_SECOND = 32_000;

/** 받아쓸 소리를 maxSeconds 이하 조각으로 나눠요. 2바이트 단위로 자르고, 나눈 조각 길이는 비슷하게 해요. */
export function splitPcm(bytes: Uint8Array, maxSeconds: number): Uint8Array[] {
  const max = maxSeconds * BYTES_PER_SECOND;
  if (bytes.length <= max) return [bytes];
  const parts = Math.ceil(bytes.length / max);
  const size = Math.ceil(bytes.length / parts / 2) * 2;
  const out: Uint8Array[] = [];
  for (let at = 0; at < bytes.length; at += size) out.push(bytes.subarray(at, at + size));
  return out;
}

async function openSherpa(
  config: Record<string, unknown>,
  name: string,
  maxSeconds?: number,
): Promise<SherpaContext> {
  const init = await asr().initialize(config);
  if (!init.success) throw new SttError(init.error ?? `${name} 모델을 열지 못했어요.`);

  const recognize = async (bytes: Uint8Array): Promise<string> => {
    const file = new File(Paths.cache, `stt-sherpa-${Date.now()}.wav`);
    try {
      const wav = new Uint8Array(44 + bytes.length);
      wav.set(wavHeader(bytes.length), 0);
      wav.set(bytes, 44);
      if (file.exists) file.delete();
      file.create();
      file.write(wav);
      const answer = await asr().recognizeFromFile(file.uri);
      if (!answer.success) throw new SttError(answer.error ?? `${name}로 받아쓰지 못했어요.`);
      return stripTags(answer.text ?? '');
    } finally {
      if (file.exists) file.delete();
    }
  };

  // 한 번에 하나씩 받아써요.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    transcribeData(pcm) {
      let aborted = false;
      const promise = queue.then(async (): Promise<Result> => {
        const all = new Uint8Array(pcm);
        const segments: Result['segments'] = [];
        let at = 0;
        for (const part of maxSeconds ? splitPcm(all, maxSeconds) : [all]) {
          if (aborted) return { result: '', segments: [], isAborted: true };
          const text = await recognize(part);
          // whisper.cpp처럼 10ms 단위예요. 1ms = 32바이트
          const t0 = Math.round(at / 32 / 10);
          at += part.length;
          if (text) segments.push({ text, t0, t1: Math.round(at / 32 / 10) });
        }
        return {
          result: segments.map((s) => s.text).join(' '),
          segments,
          isAborted: aborted,
        };
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

export function openSenseVoice(model: SttModel): Promise<SherpaContext> {
  return openSherpa(
    {
      modelDir: packDir(model).uri,
      modelType: 'sense_voice',
      modelFiles: { model: model.files[0]!.name, tokens: model.files[1]!.name },
      language: 'ko',
      useItn: true,
      numThreads: 4,
    },
    'SenseVoice',
  );
}

/** Qwen3-ASR 한 번에 넣는 소리 길이(초). LocalSTT도 28초까지 넣어요. */
const QWEN3_MAX_SECONDS = 28;

/** Qwen3-ASR 0.6B. words: 내 단어(해시태그 등)를 hotwords로 줘요. */
export function openQwen3(model: SttModel, words: string[] = []): Promise<SherpaContext> {
  const hotwords = [...new Set(words.map((w) => w.replace(/^#/, '').trim()))]
    .filter((w) => w.length >= 2 && w.length <= 15)
    .slice(0, 30)
    .join(',');
  return openSherpa(
    {
      modelDir: packDir(model).uri,
      modelType: 'qwen3',
      modelFiles: {
        convFrontend: 'conv_frontend.onnx',
        encoder: 'encoder.int8.onnx',
        decoder: 'decoder.int8.onnx',
        tokenizer: 'tokenizer',
      },
      numThreads: 4,
      // 기본값(새 토큰 128)이면 28초 한국어가 잘려요.
      qwen3: { maxNewTokens: 512, maxTotalLen: 2048 },
      ...(hotwords ? { hotwords } : {}),
    },
    'Qwen3-ASR',
    QWEN3_MAX_SECONDS,
  );
}
