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
