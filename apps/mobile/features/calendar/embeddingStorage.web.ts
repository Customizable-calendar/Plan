import { parseSafetensorsHeader } from './embeddingMath';
import { EMBEDDING_MODEL, EMBEDDING_MODEL_BYTES, EmbeddingStorageError } from './embeddingSpec';

const DB_NAME = 'calendar-embedding-v1';
const STORE_NAME = 'files';
const HEADER_PEEK_BYTES = 512;

type StoredFileRecord = {
  name: string;
  blob: Blob;
  bytes: number;
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new EmbeddingStorageError('이 브라우저에서는 로컬 저장소를 사용할 수 없어요.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getRecord(name: string): Promise<StoredFileRecord | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(name);
      req.onsuccess = () => resolve((req.result as StoredFileRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putRecord(record: StoredFileRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function clearStore(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function isEmbeddingModelDownloaded(): Promise<boolean> {
  if (!hasIndexedDb()) return false;
  try {
    for (const f of EMBEDDING_MODEL.files) {
      const rec = await getRecord(f.name);
      if (!rec || rec.blob.size !== f.bytes) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getEmbeddingPartialRatio(): Promise<number | null> {
  return null;
}

export async function downloadEmbeddingModel(
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!hasIndexedDb()) {
    throw new EmbeddingStorageError('이 브라우저에서는 로컬 임베딩 모델을 저장할 수 없어요.');
  }

  let before = 0;
  for (const f of EMBEDDING_MODEL.files) {
    const existing = await getRecord(f.name);
    if (existing && existing.blob.size === f.bytes) {
      before += f.bytes;
      onProgress(Math.min(1, before / EMBEDDING_MODEL_BYTES));
      continue;
    }

    let res: Response;
    try {
      res = await fetch(f.url, { signal });
    } catch (e) {
      if (signal?.aborted) {
        throw new EmbeddingStorageError('받기를 멈췄어요. 다시 누르면 받을 수 있어요.');
      }
      throw new EmbeddingStorageError(
        '임베딩 모델을 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
        e,
      );
    }

    if (!res.ok) {
      throw new EmbeddingStorageError(`임베딩 모델을 받지 못했어요. (HTTP ${res.status})`);
    }

    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let loaded = 0;

    if (res.body) {
      const reader = res.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(new Uint8Array(value));
            loaded += value.byteLength;
            onProgress(Math.min(1, (before + loaded) / EMBEDDING_MODEL_BYTES));
          }
        }
      } catch (e) {
        if (signal?.aborted) {
          throw new EmbeddingStorageError('받기를 멈췄어요. 다시 누르면 받을 수 있어요.');
        }
        throw new EmbeddingStorageError('임베딩 모델을 받는 중 연결이 끊어졌어요.', e);
      }
    } else {
      const ab = await res.arrayBuffer();
      chunks.push(new Uint8Array(ab));
      loaded = ab.byteLength;
    }

    const blob = new Blob(chunks);
    if (blob.size !== f.bytes) {
      throw new EmbeddingStorageError('임베딩 모델 파일 크기가 맞지 않아요. 다시 받아 주세요.');
    }
    await putRecord({ name: f.name, blob, bytes: f.bytes });
    before += f.bytes;
    onProgress(Math.min(1, before / EMBEDDING_MODEL_BYTES));
  }
}

export async function deleteEmbeddingModel(): Promise<void> {
  await clearStore();
}

export async function readEmbeddingTokenizerText(): Promise<string | null> {
  const rec = await getRecord(EMBEDDING_MODEL.files[0].name);
  if (!rec || rec.blob.size !== EMBEDDING_MODEL.files[0].bytes) return null;
  return rec.blob.text();
}

export async function readEmbeddingRows(
  tokenIds: readonly number[],
): Promise<Map<number, { scale: number; values: Int8Array }> | null> {
  const rec = await getRecord(EMBEDDING_MODEL.files[1].name);
  if (!rec || rec.blob.size !== EMBEDDING_MODEL.files[1].bytes) return null;

  const headBuffer = await rec.blob.slice(0, HEADER_PEEK_BYTES).arrayBuffer();
  const layout = parseSafetensorsHeader(headBuffer);
  const uniqueIds = [...new Set(tokenIds)].filter((id) => id >= 0 && id < layout.vocabSize);
  const result = new Map<number, { scale: number; values: Int8Array }>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      const [wBuf, eBuf] = await Promise.all([
        rec.blob
          .slice(layout.weightsOffset + id * 4, layout.weightsOffset + id * 4 + 4)
          .arrayBuffer(),
        rec.blob
          .slice(
            layout.embeddingsOffset + id * layout.dim,
            layout.embeddingsOffset + (id + 1) * layout.dim,
          )
          .arrayBuffer(),
      ]);
      const scale = new DataView(wBuf).getFloat32(0, true);
      result.set(id, { scale, values: new Int8Array(eBuf) });
    }),
  );

  return result;
}
