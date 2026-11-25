import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { parseSafetensorsHeader } from './embeddingMath';
import {
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_BYTES,
  type EmbeddingModelFile,
  EmbeddingStorageError,
} from './embeddingSpec';

const PIECE_BYTES = 16 * 1024 * 1024;
const HEADER_PEEK_BYTES = 512;

function modelDir(): Directory {
  const dir = new Directory(Paths.document, 'calendar-embedding', EMBEDDING_MODEL.dir);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function targetFile(name: string): File {
  return new File(modelDir(), name);
}

function partFile(name: string): File {
  return new File(modelDir(), `${name}.part`);
}

function receivedOf(f: EmbeddingModelFile): number {
  const file = targetFile(f.name);
  if (file.exists && file.size === f.bytes) return f.bytes;
  const part = partFile(f.name);
  return part.exists ? Math.min(part.size, f.bytes) : 0;
}

export async function isEmbeddingModelDownloaded(): Promise<boolean> {
  return EMBEDDING_MODEL.files.every((f) => {
    const file = targetFile(f.name);
    return file.exists && file.size === f.bytes;
  });
}

export async function getEmbeddingPartialRatio(): Promise<number | null> {
  if (await isEmbeddingModelDownloaded()) return null;
  const got = EMBEDDING_MODEL.files.reduce((sum, f) => sum + receivedOf(f), 0);
  return got > 0 ? got / EMBEDDING_MODEL_BYTES : null;
}

export async function downloadEmbeddingModel(
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  let before = 0;
  for (const f of EMBEDDING_MODEL.files) {
    if (receivedOf(f) < f.bytes || !targetFile(f.name).exists) {
      const base = before;
      await downloadSingleFile(
        f,
        (bytes) => onProgress(Math.min(1, (base + bytes) / EMBEDDING_MODEL_BYTES)),
        signal,
      );
    }
    before += f.bytes;
  }
}

async function downloadSingleFile(
  f: EmbeddingModelFile,
  onBytes: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const part = partFile(f.name);
  if (part.exists && part.size > f.bytes) part.delete();
  if (!part.exists) part.create();
  const piece = targetFile(`${f.name}.piece`);

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
        part.delete();
        await piece.move(part);
        break;
      }
      if (piece.size !== end - start + 1) {
        part.delete();
        throw new EmbeddingStorageError('모델 파일을 이어 받지 못했어요. 다시 받아 주세요.');
      }
      await part.write(await piece.bytes(), { append: true });
      piece.delete();
      onBytes(part.size);
    }
  } catch (e) {
    if (piece.exists) piece.delete();
    if (signal?.aborted) {
      throw new EmbeddingStorageError('받기를 멈췄어요. 다시 누르면 받은 데부터 이어 받아요.');
    }
    if (e instanceof EmbeddingStorageError) throw e;
    throw new EmbeddingStorageError(
      '임베딩 모델을 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
      e,
    );
  }

  if (part.size !== f.bytes) {
    part.delete();
    throw new EmbeddingStorageError('임베딩 모델 파일이 덜 받아졌어요. 다시 받아 주세요.');
  }
  const dest = targetFile(f.name);
  if (dest.exists) dest.delete();
  await part.move(dest);
}

export async function deleteEmbeddingModel(): Promise<void> {
  for (const f of EMBEDDING_MODEL.files) {
    for (const name of [f.name, `${f.name}.part`, `${f.name}.piece`]) {
      const file = targetFile(name);
      if (file.exists) file.delete();
    }
  }
}

export async function readEmbeddingTokenizerText(): Promise<string | null> {
  if (!(await isEmbeddingModelDownloaded())) return null;
  const tokFile = targetFile(EMBEDDING_MODEL.files[0].name);
  const ab = await tokFile.arrayBuffer();
  return new TextDecoder().decode(new Uint8Array(ab));
}

export async function readEmbeddingRows(
  tokenIds: readonly number[],
): Promise<Map<number, { scale: number; values: Int8Array }> | null> {
  if (!(await isEmbeddingModelDownloaded())) return null;
  const modelFile = targetFile(EMBEDDING_MODEL.files[1].name);
  const handle = modelFile.open(FileMode.ReadOnly);
  const result = new Map<number, { scale: number; values: Int8Array }>();

  try {
    handle.offset = 0;
    const headBytes = await handle.readBytes(HEADER_PEEK_BYTES);
    const headBuffer = headBytes.buffer.slice(
      headBytes.byteOffset,
      headBytes.byteOffset + headBytes.byteLength,
    );
    const layout = parseSafetensorsHeader(headBuffer);
    const uniqueIds = [...new Set(tokenIds)].filter((id) => id >= 0 && id < layout.vocabSize);

    for (const id of uniqueIds) {
      handle.offset = layout.weightsOffset + id * 4;
      const wBytes = await handle.readBytes(4);
      const scale = new DataView(wBytes.buffer, wBytes.byteOffset, 4).getFloat32(0, true);

      handle.offset = layout.embeddingsOffset + id * layout.dim;
      const eBytes = await handle.readBytes(layout.dim);
      const values = new Int8Array(eBytes.buffer, eBytes.byteOffset, layout.dim);
      result.set(id, { scale, values: new Int8Array(values) });
    }
  } finally {
    handle.close();
  }

  return result;
}
