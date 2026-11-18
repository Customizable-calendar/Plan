import { Directory, File, Paths } from 'expo-file-system';

import { SttError } from './errors';

// 받아쓰기 모델은 앱에 넣지 않고 처음 쓸 때 기기에 받아요. 크기로 다 받았는지 확인해요.
// 모델을 바꾸면 bytes도 같이 바꿔요.
// - whisper(whisper.cpp ggml, MIT): 문장 부호·예시(prompt)를 잘 따라요. 무거워요.
// - SenseVoice(sherpa-onnx, FunASR 모델 라이선스 1.1): 한 번에 통째로 받아써서 훨씬 빠르고,
//   지어낸 말이 적고 부호도 찍어요. 예시(내 단어)는 못 써요. SpokenLog 참고.
export type SttModelId = 'small' | 'base' | 'sensevoice';

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
  engine: 'whisper' | 'sensevoice';
}

const WHISPER_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const SENSE_VOICE_URL =
  'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/';

export const MODELS: SttModel[] = [
  {
    id: 'small',
    engine: 'whisper',
    label: '정확하게',
    note: '한국어 추천, 190MB',
    files: [
      { name: 'ggml-small-q5_1.bin', url: `${WHISPER_URL}ggml-small-q5_1.bin`, bytes: 190_085_487 },
    ],
  },
  {
    id: 'sensevoice',
    engine: 'sensevoice',
    label: '아주 빠르게 (SenseVoice)',
    note: '긴 회의에 적당, 내 단어 예시는 못 써요, 240MB',
    dir: 'sense-voice-int8',
    files: [
      { name: 'model.int8.onnx', url: `${SENSE_VOICE_URL}model.int8.onnx`, bytes: 239_233_841 },
      { name: 'tokens.txt', url: `${SENSE_VOICE_URL}tokens.txt`, bytes: 315_894 },
    ],
  },
  {
    id: 'base',
    engine: 'whisper',
    label: '빠르게',
    note: '짧은 말에 적당, 60MB',
    files: [
      { name: 'ggml-base-q5_1.bin', url: `${WHISPER_URL}ggml-base-q5_1.bin`, bytes: 59_707_625 },
    ],
  },
];

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

export function packFile(pack: ModelPack, name: string): File {
  return new File(packDir(pack), name);
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
