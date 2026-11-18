import { Directory, File, Paths } from 'expo-file-system';

import { SttError } from './errors';

// 받아쓰기 모델(whisper.cpp ggml, MIT)은 앱에 넣지 않고 처음 쓸 때 기기에 받아요.
// 크기로 다 받았는지 확인해요. 모델을 바꾸면 bytes도 같이 바꿔요.
export type SttModelId = 'small' | 'base';

export interface SttModel {
  id: SttModelId;
  label: string;
  note: string;
  file: string;
  bytes: number;
}

export const MODELS: SttModel[] = [
  {
    id: 'small',
    label: '정확하게',
    note: '한국어 추천, 190MB',
    file: 'ggml-small-q5_1.bin',
    bytes: 190_085_487,
  },
  {
    id: 'base',
    label: '빠르게',
    note: '짧은 말에 적당, 60MB',
    file: 'ggml-base-q5_1.bin',
    bytes: 59_707_625,
  },
];

const BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

function folder(): Directory {
  const dir = new Directory(Paths.document, 'stt');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function modelFile(model: SttModel): File {
  return new File(folder(), model.file);
}

export function isDownloaded(model: SttModel): boolean {
  const file = modelFile(model);
  return file.exists && file.size === model.bytes;
}

/** 한 번에 받는 크기. 끊기면 다음엔 받은 데까지 건너뛰고 이어서 받아요. */
const PIECE_BYTES = 16 * 1024 * 1024;

const partFile = (model: SttModel) => new File(folder(), `${model.file}.part`);

/** 받다 만 모델이 있으면 받은 비율(0~1), 없으면 null. 다시 받기를 누르면 여기서부터 이어 받아요. */
export function partialRatio(model: SttModel): number | null {
  const part = partFile(model);
  if (!part.exists || part.size <= 0 || part.size >= model.bytes) return null;
  return part.size / model.bytes;
}

/**
 * 모델을 받아요. 16MB씩(HTTP Range) 받아서 .part 뒤에 붙이고, 크기가 맞으면 이름을 바꿔요.
 * 인터넷이 끊기거나 앱이 꺼지거나 멈춰도 .part가 남아서, 다음에 받은 데부터 이어 받아요(SpokenLog 참고).
 */
export async function downloadModel(
  model: SttModel,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const part = partFile(model);
  if (part.exists && part.size > model.bytes) part.delete();
  if (!part.exists) part.create();
  const piece = new File(folder(), `${model.file}.piece`);
  try {
    while (part.size < model.bytes) {
      const start = part.size;
      const end = Math.min(start + PIECE_BYTES, model.bytes) - 1;
      if (piece.exists) piece.delete();
      await File.downloadFileAsync(BASE_URL + model.file, piece, {
        headers: { Range: `bytes=${start}-${end}` },
        idempotent: true,
        signal,
        onProgress: ({ bytesWritten }) =>
          onProgress(Math.min(1, (start + bytesWritten) / model.bytes)),
      });
      if (piece.size === model.bytes && start === 0) {
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
      onProgress(part.size / model.bytes);
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
  if (part.size !== model.bytes) {
    part.delete();
    throw new SttError('모델 파일이 덜 받아졌어요. 다시 받아 주세요.');
  }
  const file = modelFile(model);
  if (file.exists) file.delete();
  // SDK 58부터 move가 Promise예요. 기다리지 않으면 이름이 바뀌기 전에 목록을 다시 봐서 "받기"가 그대로 남아요.
  await part.move(file);
}

export function deleteModel(model: SttModel): void {
  const file = modelFile(model);
  if (file.exists) file.delete();
  const part = partFile(model);
  if (part.exists) part.delete();
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
