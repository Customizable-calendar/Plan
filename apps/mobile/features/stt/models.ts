import { Directory, File, Paths } from 'expo-file-system';

import { SttError } from './errors';

// 받아쓰기 모델은 앱에 넣지 않고 처음 쓸 때 기기에 받아요. 크기로 다 받았는지 확인해요.
// 모델을 바꾸면 bytes도 같이 바꿔요.
// - whisper-large-v3-turbo 한국어 파인튜닝(whisper.cpp ggml q5_0, Apache-2.0): 기본.
//   whisper.rn으로 바로 돌아가고(추가 네이티브 엔진 불필요) 한국어 회의·소음 환경에서도 정확해요.
// - whisper base(whisper.cpp ggml, MIT): 가벼워요. 오래된 폰에서 빠르게 받아쓸 때 써요.
// 예전에 있던 whisper small, SenseVoice, Qwen3-ASR 파일은 RETIRED로 지워서 공간을 돌려줘요.
export type SttModelId = 'turbo-ko' | 'base';

/** 받을 파일 하나 */
export interface ModelFile {
  name: string;
  url: string;
  bytes: number;
}

/** 같이 받는 파일 묶음(모델 하나). dir: Documents/stt 아래 폴더, 없으면 바로 아래 */
export interface ModelPack {
  label: string;
  note: string;
  dir?: string;
  files: ModelFile[];
}

export interface SttModel extends ModelPack {
  id: SttModelId;
  engine: 'whisper' | 'qwen3';
}

const WHISPER_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
// 고친 모델이 올라와도 받는 파일이 바뀌지 않게 커밋으로 고정해요.
const WHISPER_TURBO_KO_URL =
  'https://huggingface.co/JoaoZaokk/whisper-large-v3-turbo-korean-ggml/resolve/c4f74b15c9d4e7889871c5450327b5fd1f13f059/';

export const MODELS: SttModel[] = [
  {
    id: 'turbo-ko',
    engine: 'whisper',
    label: '가장 정확하게 (whisper turbo 한국어)',
    note: '한국어 특화, 회의에 추천, 547MB',
    files: [
      {
        name: 'ggml-whisper-large-v3-turbo-korean-q5_0.bin',
        url: `${WHISPER_TURBO_KO_URL}ggml-whisper-large-v3-turbo-korean-q5_0.bin`,
        bytes: 574_041_195,
      },
    ],
  },
  {
    id: 'base',
    engine: 'whisper',
    label: '가볍게 (whisper base)',
    note: '오래된 폰에 적당, 60MB',
    files: [
      { name: 'ggml-base-q5_1.bin', url: `${WHISPER_URL}ggml-base-q5_1.bin`, bytes: 59_707_625 },
    ],
  },
];

/** 회색 글을 맡는 가벼운 모델(whisper base) */
export const PREVIEW_MODEL = MODELS.find((m) => m.id === 'base')!;

/** 예전에 받을 수 있던 모델. 받아 둔 파일이 남아 있으면 지워서 공간을 돌려줘요. */
const RETIRED: ModelPack[] = [
  {
    label: 'whisper small',
    note: '',
    files: [{ name: 'ggml-small-q5_1.bin', url: '', bytes: 190_085_487 }],
  },
  {
    label: 'SenseVoice',
    note: '',
    dir: 'sense-voice-int8',
    files: [
      { name: 'model.int8.onnx', url: '', bytes: 239_233_841 },
      { name: 'tokens.txt', url: '', bytes: 315_894 },
    ],
  },
  {
    label: 'Qwen3-ASR 0.6B',
    note: '',
    dir: 'qwen3-asr-0.6b-int8',
    files: [
      { name: 'conv_frontend.onnx', url: '', bytes: 44_148_281 },
      { name: 'encoder.int8.onnx', url: '', bytes: 182_491_662 },
      { name: 'decoder.int8.onnx', url: '', bytes: 755_914_231 },
      { name: 'tokenizer/merges.txt', url: '', bytes: 1_671_853 },
      { name: 'tokenizer/tokenizer_config.json', url: '', bytes: 12_487 },
      { name: 'tokenizer/vocab.json', url: '', bytes: 2_776_833 },
    ],
  },
  {
    label: 'Qwen3-ASR 1.7B',
    note: '',
    dir: 'qwen3-asr-1.7b-q8',
    files: [
      { name: 'Qwen3-ASR-1.7B-Q8_0.gguf', url: '', bytes: 2_165_034_944 },
      { name: 'mmproj-Qwen3-ASR-1.7B-Q8_0.gguf', url: '', bytes: 355_709_344 },
    ],
  },
];

/** 예전 모델 파일을 지워요. 지운 게 있으면 true */
export function removeRetiredModels(): boolean {
  let removed = false;
  for (const pack of RETIRED) {
    for (const f of pack.files) {
      for (const name of [f.name, `${f.name}.part`, `${f.name}.piece`]) {
        try {
          const file = new File(packDir(pack), name);
          if (file.exists) {
            file.delete();
            removed = true;
          }
        } catch {
          // 못 지우면 다음에 다시 해 봐요.
        }
      }
    }
  }
  return removed;
}

/**
 * 누가 말했는지 나누는(화자 구분) 모델. 받아쓴 뒤에 녹음 원본으로 돌려요(sherpa-onnx, SpokenLog 참고).
 * pyannote segmentation 3.0(MIT) + 3D-Speaker ERes2Net(Apache-2.0), 약 45MB.
 */
export const SPEAKER_MODEL: ModelPack = {
  label: '화자 구분',
  note: '누가 말했는지 나눠요, 45MB',
  dir: 'speakers',
  files: [
    {
      name: 'model.onnx',
      url: 'https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/main/model.onnx',
      bytes: 5_992_913,
    },
    {
      name: '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx',
      url: 'https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx',
      bytes: 39_593_761,
    },
  ],
};

function folder(): Directory {
  const dir = new Directory(Paths.document, 'stt');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** 모델 파일이 있는 폴더 */
export function packDir(pack: ModelPack): Directory {
  if (!pack.dir) return folder();
  const dir = new Directory(folder(), pack.dir);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** 모델 파일. 이름에 폴더가 있으면(tokenizer/vocab.json) 그 폴더를 만들어 둬요. */
export function packFile(pack: ModelPack, name: string): File {
  const slash = name.lastIndexOf('/');
  if (slash < 0) return new File(packDir(pack), name);
  const dir = new Directory(packDir(pack), name.slice(0, slash));
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, name.slice(slash + 1));
}

/** whisper 모델 파일(파일이 하나예요) */
export function modelFile(model: SttModel): File {
  return packFile(model, model.files[0]!.name);
}

export const packBytes = (pack: ModelPack) => pack.files.reduce((sum, f) => sum + f.bytes, 0);

export function isDownloaded(pack: ModelPack): boolean {
  return pack.files.every((f) => {
    const file = packFile(pack, f.name);
    return file.exists && file.size === f.bytes;
  });
}

/** 한 번에 받는 크기. 끊기면 다음엔 받은 데까지 건너뛰고 이어서 받아요. */
const PIECE_BYTES = 16 * 1024 * 1024;

const partOf = (pack: ModelPack, f: ModelFile) => packFile(pack, `${f.name}.part`);

/** 이 파일을 지금까지 받은 바이트 */
function receivedOf(pack: ModelPack, f: ModelFile): number {
  const file = packFile(pack, f.name);
  if (file.exists && file.size === f.bytes) return f.bytes;
  const part = partOf(pack, f);
  return part.exists ? Math.min(part.size, f.bytes) : 0;
}

/** 받다 만 모델이 있으면 받은 비율(0~1), 없으면 null. 다시 받기를 누르면 여기서부터 이어 받아요. */
export function partialRatio(pack: ModelPack): number | null {
  if (isDownloaded(pack)) return null;
  const got = pack.files.reduce((sum, f) => sum + receivedOf(pack, f), 0);
  return got > 0 ? got / packBytes(pack) : null;
}

/**
 * 모델을 받아요. 파일마다 16MB씩(HTTP Range) 받아서 .part 뒤에 붙이고, 크기가 맞으면 이름을 바꿔요.
 * 인터넷이 끊기거나 앱이 꺼지거나 멈춰도 .part가 남아서, 다음에 받은 데부터 이어 받아요(SpokenLog 참고).
 */
export async function downloadModel(
  pack: ModelPack,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const total = packBytes(pack);
  let before = 0; // 앞 파일들 바이트
  for (const f of pack.files) {
    if (receivedOf(pack, f) < f.bytes || !packFile(pack, f.name).exists) {
      const base = before;
      await downloadFile(
        pack,
        f,
        (bytes) => onProgress(Math.min(1, (base + bytes) / total)),
        signal,
      );
    }
    before += f.bytes;
  }
}

async function downloadFile(
  pack: ModelPack,
  f: ModelFile,
  onBytes: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const part = partOf(pack, f);
  if (part.exists && part.size > f.bytes) part.delete();
  if (!part.exists) part.create();
  const piece = packFile(pack, `${f.name}.piece`);
  try {
    while (part.size < f.bytes) {
      const start = part.size;
      const end = Math.min(start + PIECE_BYTES, f.bytes) - 1;
      if (piece.exists) piece.delete();
      await File.downloadFileAsync(f.url, piece, {
        headers: { Range: `bytes=${start}-${end}` },
        idempotent: true,
        signal,
        onProgress: ({ bytesWritten }) => onBytes(start + bytesWritten),
      });
      if (piece.size === f.bytes && start === 0) {
        // 서버가 나눠 받기를 무시하고 통째로 보냈어요. 그대로 써요.
        part.delete();
        await piece.move(part);
        break;
      }
      if (piece.size !== end - start + 1) {
        // 나눠 받기가 안 되는 응답이에요. 이어 붙이면 파일이 깨져서 처음부터 다시 받게 해요.
        part.delete();
        throw new SttError('모델 파일을 이어 받지 못했어요. 다시 받아 주세요.');
      }
      await part.write(await piece.bytes(), { append: true });
      piece.delete();
      onBytes(part.size);
    }
  } catch (e) {
    if (piece.exists) piece.delete();
    if (signal?.aborted)
      throw new SttError('받기를 멈췄어요. 다시 누르면 받은 데부터 이어 받아요.');
    if (e instanceof SttError) throw e;
    throw new SttError(
      '모델을 받지 못했어요. 인터넷 연결을 확인하고 다시 누르면 받은 데부터 이어 받아요.',
      e,
    );
  }
  if (part.size !== f.bytes) {
    part.delete();
    throw new SttError('모델 파일이 덜 받아졌어요. 다시 받아 주세요.');
  }
  const file = packFile(pack, f.name);
  if (file.exists) file.delete();
  // SDK 58부터 move가 Promise예요. 기다리지 않으면 이름이 바뀌기 전에 목록을 다시 봐서 "받기"가 그대로 남아요.
  await part.move(file);
}

export function deleteModel(pack: ModelPack): void {
  for (const f of pack.files) {
    for (const name of [f.name, `${f.name}.part`, `${f.name}.piece`]) {
      const file = packFile(pack, name);
      if (file.exists) file.delete();
    }
  }
}

// ---------- 말소리 감지(VAD) 모델 ----------
// Silero VAD(MIT)의 ggml 판이에요. 작아서(약 0.9MB) 처음 받아쓸 때 알아서 받아요.
// 못 받으면 소리 크기만 보고 잘라요(받아쓰기는 그대로 돼요).

const VAD_MODEL = {
  file: 'ggml-silero-v6.2.0.bin',
  bytes: 885_098,
  url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
};

export function vadFile(): File {
  return new File(folder(), VAD_MODEL.file);
}

/** VAD 모델이 없으면 받아요. 실패하면 던져요. */
export async function ensureVadModel(): Promise<File> {
  const file = vadFile();
  if (file.exists && file.size === VAD_MODEL.bytes) return file;
  const part = new File(folder(), `${VAD_MODEL.file}.part`);
  if (part.exists) part.delete();
  await File.downloadFileAsync(VAD_MODEL.url, part, { idempotent: true });
  if (part.size !== VAD_MODEL.bytes) {
    part.delete();
    throw new SttError('말소리 감지 모델이 덜 받아졌어요.');
  }
  if (file.exists) file.delete();
  await part.move(file);
  return file;
}
