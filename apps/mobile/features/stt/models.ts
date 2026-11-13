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

/** 모델을 받아요. 다 받기 전에는 .part로 두고, 크기가 맞으면 이름을 바꿔요. */
export async function downloadModel(
  model: SttModel,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const part = new File(folder(), `${model.file}.part`);
  if (part.exists) part.delete();
  try {
    await File.downloadFileAsync(BASE_URL + model.file, part, {
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten }) => onProgress(Math.min(1, bytesWritten / model.bytes)),
    });
  } catch (e) {
    if (part.exists) part.delete();
    if (signal?.aborted) throw new SttError('받기를 멈췄어요.');
    throw new SttError('모델을 받지 못했어요. 인터넷 연결을 확인하고 다시 받아 주세요.', e);
  }
  if (part.size !== model.bytes) {
    part.delete();
    throw new SttError('모델 파일이 덜 받아졌어요. 다시 받아 주세요.');
  }
  const file = modelFile(model);
  if (file.exists) file.delete();
  part.move(file);
}

export function deleteModel(model: SttModel): void {
  const file = modelFile(model);
  if (file.exists) file.delete();
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
  part.move(file);
  return file;
}
