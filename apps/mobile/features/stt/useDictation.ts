import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type Dictation,
  MAX_SECONDS,
  resumeLeftover,
  type SttResult,
  startDictation,
} from './engine';
import { SttError } from './errors';
import type { SttModel } from './models';

export type DictationState =
  | { phase: 'idle' }
  /** partial: 받아쓴 글, preview: 아직 조각이 안 된 말을 미리 받아쓴 글, backlog: 못 받아쓴 조각 수 */
  | { phase: 'recording'; seconds: number; partial: string; preview: string; backlog: number }
  | { phase: 'transcribing'; ratio: number }
  | { phase: 'done'; result: SttResult }
  | { phase: 'error'; message: string };

const messageOf = (e: unknown) =>
  e instanceof SttError ? e.message : '받아쓰기 중에 문제가 생겼어요. 다시 해 주세요.';

const KEEP_AWAKE_TAG = 'stt';

/**
 * 녹음 버튼 하나로 쓰는 받아쓰기 훅이에요. 편집기(A) 녹음 버튼도 이걸 쓰면 돼요.
 * start() → 말하기(state.preview에 바로, 조각마다 state.partial에 글이 늘어나요) → finish() → state.result.text
 * resume(): 앱이 꺼져서 다 못 받아쓴 녹음을 이어서 받아써요(leftoverSeconds()로 있는지 봐요).
 * onDone: 받아쓰기가 끝나면 결과로 한 번 불러요. (최대 길이에서 알아서 끝나도요)
 */
export function useDictation(model: SttModel, onDone?: (result: SttResult) => void) {
  const [state, setState] = useState<DictationState>({ phase: 'idle' });
  const current = useRef<Dictation | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const start = useCallback(async () => {
    try {
      current.current = await startDictation(model);
      setState({ phase: 'recording', seconds: 0, partial: '', preview: '', backlog: 0 });
    } catch (e) {
      setState({ phase: 'error', message: messageOf(e) });
    }
  }, [model]);

  const transcribe = useCallback(
    async (work: (onProgress: (ratio: number) => void) => Promise<SttResult>) => {
      setState({ phase: 'transcribing', ratio: 0 });
      try {
        const result = await work((ratio) => setState({ phase: 'transcribing', ratio }));
        setState({ phase: 'done', result });
        done.current?.(result);
      } catch (e) {
        setState({ phase: 'error', message: messageOf(e) });
      }
    },
    [],
  );

  const finish = useCallback(async () => {
    const dictation = current.current;
    if (!dictation) return;
    current.current = null;
    await transcribe((onProgress) => dictation.finish(onProgress));
  }, [transcribe]);

  const resume = useCallback(
    () => transcribe((onProgress) => resumeLeftover(model, onProgress)),
    [model, transcribe],
  );

  const cancel = useCallback(async () => {
    await current.current?.cancel();
    current.current = null;
    setState({ phase: 'idle' });
  }, []);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  // 녹음하는 동안 시간과 받아쓴 글을 올리고, 최대 길이가 되면 알아서 끝내요.
  const recording = state.phase === 'recording';
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const d = current.current;
      if (!d) return;
      const seconds = d.seconds();
      if (seconds >= MAX_SECONDS) void finish();
      else
        setState({
          phase: 'recording',
          seconds,
          partial: d.partial(),
          preview: d.preview(),
          backlog: d.backlog(),
        });
    }, 500);
    return () => clearInterval(timer);
  }, [recording, finish]);

  // 녹음하고 받아쓰는 동안 화면이 꺼지지 않게 해요. 꺼지면 녹음이 멈출 수 있어요.
  const busy = recording || state.phase === 'transcribing';
  useEffect(() => {
    if (!busy) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, [busy]);

  // 화면을 나가면 녹음을 버려요.
  useEffect(() => () => void current.current?.cancel(), []);

  return { state, start, finish, resume, cancel, reset };
}
