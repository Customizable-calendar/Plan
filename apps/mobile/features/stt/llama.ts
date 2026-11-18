import { File, Paths } from 'expo-file-system';
import { Platform, TurboModuleRegistry } from 'react-native';

import { SttError } from './errors';
import { packFile, type SttModel } from './models';
import { wavHeader } from './recordings';
import { type SherpaContext, splitPcm, stripTags } from './sensevoice';

// Qwen3-ASR 1.7B를 llama.rn(llama.cpp, MIT)으로 돌려요. (담당: B)
// LocalSTT 한국어 벤치마크 1등 모델(CER 5.6%)이에요. 0.6B(sherpa-onnx)보다 정확하지만 커서(약 2.4GB)
// GPU(OpenCL, Snapdragon Adreno 700+)나 NPU(Hexagon, Snapdragon 8 Gen 1+)가 잡히는 폰에서만 보여 줘요.
// iOS는 Metal로 돌아요. 엔진이 whisper와 같게 쓰도록 whisper.rn 컨텍스트 모양으로 감쌌어요.
// 라이브러리는 불러오는 순간 네이티브를 찾아서, 있는지 먼저 보고(hasLlama) 쓸 때 불러와요. 웹은 llama.web.ts예요.

interface LlamaCompletion {
  text: string;
}
interface LlamaContext {
  gpu: boolean;
  reasonNoGPU: string;
  initMultimodal(options: { path: string; use_gpu?: boolean }): Promise<boolean>;
  getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }>;
  completion(params: {
    messages: {
      role: string;
      content:
        string | { type: string; text?: string; input_audio?: { format: string; url: string } }[];
    }[];
    n_predict?: number;
    temperature?: number;
  }): Promise<LlamaCompletion>;
  stopCompletion(): Promise<void>;
  releaseMultimodal(): Promise<void>;
  release(): Promise<void>;
}
interface BackendDevice {
  backend: string;
  type: string;
  deviceName: string;
  maxMemorySize: number;
}
interface LlamaModule {
  initLlama(params: Record<string, unknown>): Promise<LlamaContext>;
  getBackendDevicesInfo(): Promise<BackendDevice[]>;
}

/** 이 앱 빌드에 llama.rn이 들어 있는지 */
export function hasLlama(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return TurboModuleRegistry.get('RNLlama') != null;
  } catch {
    return false;
  }
}

function llama(): LlamaModule {
  if (!hasLlama())
    throw new SttError('이 앱 버전에는 Qwen3 1.7B 엔진이 없어요. 새 APK를 깔아 주세요.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('llama.rn') as LlamaModule;
}

let accelerated: Promise<boolean> | null = null;

/**
 * 이 폰에서 GPU나 NPU로 돌릴 수 있는지. 모델을 받기 전에 장치 목록으로만 봐요.
 * iOS는 Metal이 늘 있어요. Android는 llama.rn이 OpenCL(GPU)이나 Hexagon(NPU) 장치를 찾았을 때예요.
 */
export function canAccelerate(): Promise<boolean> {
  accelerated ??= (async () => {
    if (!hasLlama()) return false;
    if (Platform.OS === 'ios') return true;
    try {
      const devices = await llama().getBackendDevicesInfo();
      return devices.some(
        (d) =>
          /opencl|hexagon|htp|vulkan/i.test(d.backend) ||
          (/gpu|accel/i.test(d.type) && !/cpu/i.test(d.backend)),
      );
    } catch {
      return false;
    }
  })();
  return accelerated;
}

/** Qwen3-ASR 한 번에 넣는 소리 길이(초). LocalSTT와 같아요. */
const MAX_SECONDS = 28;

/** Qwen3-ASR 1.7B GGUF + 오디오 projector(mmproj). words: 내 단어, 시스템 글(context)로 줘요. */
export async function openLlamaQwen3(
  model: SttModel,
  words: string[] = [],
): Promise<SherpaContext> {
  const [main, projector] = model.files;
  const context = await llama().initLlama({
    model: packFile(model, main!.name).uri.replace(/^file:\/\//, ''),
    n_ctx: 4096,
    n_gpu_layers: 99,
    // 오디오 같은 멀티모달은 문맥 밀기를 꺼야 해요(llama.rn 안내).
    ctx_shift: false,
    use_mmap: true,
  });
  const ok = await context.initMultimodal({
    path: packFile(model, projector!.name).uri.replace(/^file:\/\//, ''),
    use_gpu: true,
  });
  const support = ok ? await context.getMultimodalSupport() : { audio: false };
  if (!support.audio) {
    await context.release().catch(() => {});
    throw new SttError('Qwen3 1.7B 소리 모델을 열지 못했어요. 모델을 지우고 다시 받아 주세요.');
  }

  const system = [...new Set(words.map((w) => w.replace(/^#/, '').trim()))]
    .filter((w) => w.length >= 2 && w.length <= 15)
    .slice(0, 30)
    .join(', ');

  const recognize = async (bytes: Uint8Array): Promise<string> => {
    const file = new File(Paths.cache, `stt-llama-${Date.now()}.wav`);
    try {
      const wav = new Uint8Array(44 + bytes.length);
      wav.set(wavHeader(bytes.length), 0);
      wav.set(bytes, 44);
      if (file.exists) file.delete();
      file.create();
      file.write(wav);
      const result = await context.completion({
        messages: [
          // Qwen3-ASR은 시스템 글을 받아쓰기 문맥(자주 쓰는 말)으로 써요.
          ...(system ? [{ role: 'system', content: system }] : []),
          {
            role: 'user',
            content: [{ type: 'input_audio', input_audio: { format: 'wav', url: file.uri } }],
          },
        ],
        n_predict: 512,
        temperature: 0,
      });
      return stripTags(result.text ?? '');
    } finally {
      if (file.exists) file.delete();
    }
  };

  // 한 번에 하나씩 받아써요.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    transcribeData(pcm) {
      let aborted = false;
      const promise = queue.then(async () => {
        const all = new Uint8Array(pcm);
        const segments: { text: string; t0: number; t1: number }[] = [];
        let at = 0;
        for (const part of splitPcm(all, MAX_SECONDS)) {
          if (aborted) return { result: '', segments: [], isAborted: true };
          const text = await recognize(part);
          // whisper.cpp처럼 10ms 단위예요. 1ms = 32바이트
          const t0 = Math.round(at / 32 / 10);
          at += part.length;
          if (text) segments.push({ text, t0, t1: Math.round(at / 32 / 10) });
        }
        return { result: segments.map((s) => s.text).join(' '), segments, isAborted: aborted };
      });
      queue = promise.catch(() => {});
      return {
        stop: async () => {
          aborted = true;
          await context.stopCompletion().catch(() => {});
        },
        promise,
      };
    },
    async release() {
      await context.releaseMultimodal().catch(() => {});
      await context.release().catch(() => {});
    },
  };
}
