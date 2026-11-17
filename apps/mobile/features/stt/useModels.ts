import { useCallback, useEffect, useRef, useState } from 'react';

import { isSttAvailable, releaseStt } from './engine';
import { SttError } from './errors';
import {
  deleteModel,
  downloadModel,
  isDownloaded,
  MODELS,
  type SttModel,
  type SttModelId,
} from './models';

export interface ModelRow {
  model: SttModel;
  downloaded: boolean;
  /** 받는 중이면 0~1 */
  progress?: number;
}

// Expo Go에서도 파일은 볼 수 있지만, 받아도 못 쓰니 목록만 보여 줘요.
const scan = (): ModelRow[] => MODELS.map((model) => ({ model, downloaded: isDownloaded(model) }));

/** 모델 목록과 받기·지우기. 받는 중에 화면을 나가면 받기를 멈춰요. */
export function useModels() {
  const [rows, setRows] = useState<ModelRow[]>(scan);
  const [error, setError] = useState<string | null>(null);
  const aborts = useRef(new Map<SttModelId, AbortController>());

  const refresh = useCallback(() => setRows(scan()), []);

  // 받는 중에 화면을 나가면 받기를 멈춰요.
  useEffect(() => {
    const running = aborts.current;
    return () => running.forEach((a) => a.abort());
  }, []);

  const setProgress = (id: SttModelId, progress?: number) =>
    setRows((list) => list.map((r) => (r.model.id === id ? { ...r, progress } : r)));

  const download = useCallback(
    async (model: SttModel) => {
      if (aborts.current.has(model.id)) return;
      const abort = new AbortController();
      aborts.current.set(model.id, abort);
      setError(null);
      setProgress(model.id, 0);
      try {
        await downloadModel(model, (ratio) => setProgress(model.id, ratio), abort.signal);
      } catch (e) {
        if (!abort.signal.aborted) setError(e instanceof SttError ? e.message : String(e));
      } finally {
        aborts.current.delete(model.id);
        refresh();
      }
    },
    [refresh],
  );

  const stop = useCallback((model: SttModel) => aborts.current.get(model.id)?.abort(), []);

  const remove = useCallback(
    async (model: SttModel) => {
      await releaseStt();
      deleteModel(model);
      refresh();
    },
    [refresh],
  );

  return { rows, error, download, stop, remove, available: isSttAvailable() };
}
