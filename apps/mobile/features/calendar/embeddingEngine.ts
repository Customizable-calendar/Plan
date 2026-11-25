import { useEffect, useSyncExternalStore } from 'react';

import {
  buildUnigramIndex,
  poolQuantizedRows,
  tokenizeUnigram,
  type UnigramVocabIndex,
} from './embeddingMath';
import { EmbeddingStorageError } from './embeddingSpec';
import {
  deleteEmbeddingModel,
  downloadEmbeddingModel,
  getEmbeddingPartialRatio,
  isEmbeddingModelDownloaded,
  readEmbeddingRows,
  readEmbeddingTokenizerText,
} from './embeddingStorage';

export type LocalEmbeddingState = {
  downloaded: boolean;
  progress?: number;
  partial: number | null;
  error: string | null;
};

let storeState: LocalEmbeddingState = {
  downloaded: false,
  progress: undefined,
  partial: null,
  error: null,
};

let initialized = false;
let activeAbort: AbortController | null = null;
const listeners = new Set<() => void>();

let cachedVocab: UnigramVocabIndex | null = null;
const cachedVectors = new Map<string, Float32Array>();

function publish(next: Partial<LocalEmbeddingState>): void {
  storeState = { ...storeState, ...next };
  listeners.forEach((notify) => notify());
}

function clearVectorCache(): void {
  cachedVocab = null;
  cachedVectors.clear();
}

export async function refreshEmbeddingModelState(): Promise<void> {
  initialized = true;
  try {
    const [downloaded, partial] = await Promise.all([
      isEmbeddingModelDownloaded(),
      getEmbeddingPartialRatio(),
    ]);
    publish({ downloaded, partial });
  } catch {
    publish({ downloaded: false, partial: null });
  }
}

export async function startEmbeddingModelDownload(): Promise<void> {
  if (activeAbort) return;
  const abort = new AbortController();
  activeAbort = abort;
  publish({ error: null, progress: 0 });
  try {
    await downloadEmbeddingModel((ratio) => {
      if (!abort.signal.aborted) {
        publish({ progress: ratio });
      }
    }, abort.signal);
    clearVectorCache();
  } catch (e) {
    if (!abort.signal.aborted) {
      publish({
        error: e instanceof EmbeddingStorageError ? e.message : String(e),
      });
    }
  } finally {
    if (activeAbort === abort) {
      activeAbort = null;
    }
    publish({ progress: undefined });
    await refreshEmbeddingModelState();
  }
}

export function stopEmbeddingModelDownload(): void {
  activeAbort?.abort();
}

export async function removeEmbeddingModel(): Promise<void> {
  activeAbort?.abort();
  await deleteEmbeddingModel();
  clearVectorCache();
  publish({ downloaded: false, progress: undefined, partial: null, error: null });
}

/**
 * 기기에 내려받은 MIT 다국어 정적 임베딩 모델로 각 태그(+일정 제목 문맥) 벡터를 계산해요.
 * 모델이 없으면 `null`을 반환해 내장 유의어/문맥 유사도로 자연스럽게 동작해요.
 */
export async function embedTagsWithLocalModel(
  inputs: readonly { tag: string; contextText: string }[],
): Promise<Map<string, Float32Array> | null> {
  if (!(await isEmbeddingModelDownloaded())) return null;

  if (!cachedVocab) {
    const tokText = await readEmbeddingTokenizerText();
    if (!tokText) return null;
    cachedVocab = buildUnigramIndex(tokText);
  }

  const out = new Map<string, Float32Array>();
  const pending: { tag: string; cacheKey: string; tokenIds: number[] }[] = [];
  const neededIds = new Set<number>();

  for (const input of inputs) {
    const cacheKey = `${input.tag}::${input.contextText}`;
    const hit = cachedVectors.get(cacheKey);
    if (hit) {
      out.set(input.tag, hit);
      continue;
    }
    const baseWord = input.tag.replace(/^#+/, '');
    const text = input.contextText ? `${baseWord} ${baseWord} ${input.contextText}` : baseWord;
    const tokenIds = tokenizeUnigram(text, cachedVocab);
    pending.push({ tag: input.tag, cacheKey, tokenIds });
    for (const id of tokenIds) neededIds.add(id);
  }

  if (pending.length === 0) return out;

  const rowMap = await readEmbeddingRows([...neededIds]);
  if (!rowMap) return null;

  let dim = 256;
  for (const row of rowMap.values()) {
    dim = row.values.length;
    break;
  }

  for (const item of pending) {
    const rows: { scale: number; values: Int8Array }[] = [];
    for (const id of item.tokenIds) {
      const row = rowMap.get(id);
      if (row) rows.push(row);
    }
    if (rows.length > 0) {
      const vec = poolQuantizedRows(rows, dim);
      cachedVectors.set(item.cacheKey, vec);
      out.set(item.tag, vec);
    }
  }

  return out;
}

export function useLocalEmbeddingModel(): LocalEmbeddingState & {
  download: () => Promise<void>;
  stop: () => void;
  remove: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const snapshot = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => storeState,
  );

  useEffect(() => {
    if (!initialized) {
      void refreshEmbeddingModelState();
    }
  }, []);

  return {
    ...snapshot,
    download: startEmbeddingModelDownload,
    stop: stopEmbeddingModelDownload,
    remove: removeEmbeddingModel,
    refresh: refreshEmbeddingModelState,
  };
}
