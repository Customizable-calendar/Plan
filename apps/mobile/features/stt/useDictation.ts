import { useCallback, useEffect, useRef, useState } from 'react';

import { type Dictation, MAX_SECONDS, type SttResult, startDictation } from './engine';
import { SttError } from './errors';
import type { SttModel } from './models';

export type DictationState =
  | { phase: 'idle' }
  | { phase: 'recording'; seconds: number }
  | { phase: 'transcribing'; ratio: number }
  | { phase: 'done'; result: SttResult }
  | { phase: 'error'; message: string };

const messageOf = (e: unknown) =>
  e instanceof SttError ? e.message : '받아쓰기 중에 문제가 생겼어요. 다시 해 주세요.';

/**
 * 녹음 버튼 하나로 쓰는 받아쓰기 훅이에요. 편집기(A) 녹음 버튼도 이걸 쓰면 돼요.
 * start() → 말하기 → finish() → state.result.text
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
      setState({ phase: 'recording', seconds: 0 });
    } catch (e) {
      setState({ phase: 'error', message: messageOf(e) });
    }
  }, [model]);

  const finish = useCallback(async () => {
    const dictation = current.current;
    if (!dictation) return;
    current.current = null;
    setState({ phase: 'transcribing', ratio: 0 });
    try {
      const result = await dictation.finish((ratio) => setState({ phase: 'transcribing', ratio }));
      setState({ phase: 'done', result });
      done.current?.(result);
    } catch (e) {
      setState({ phase: 'error', message: messageOf(e) });
    }
  }, []);

  const cancel = useCallback(async () => {
    await current.current?.cancel();
    current.current = null;
    setState({ phase: 'idle' });
  }, []);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  // 녹음하는 동안 시간을 올리고, 최대 길이가 되면 알아서 끝내요.
  const recording = state.phase === 'recording';
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const seconds = current.current?.seconds() ?? 0;
      if (seconds >= MAX_SECONDS) void finish();
      else setState({ phase: 'recording', seconds });
    }, 500);
    return () => clearInterval(timer);
  }, [recording, finish]);

  // 화면을 나가면 녹음을 버려요.
  useEffect(() => () => void current.current?.cancel(), []);

  return { state, start, finish, cancel, reset };
}
