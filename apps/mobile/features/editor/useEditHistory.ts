import { useRef, useState } from 'react';

// 편집기 되돌리기(Ctrl+Z)와 다시 하기(Ctrl+Shift+Z, Ctrl+Y)에 쓰는 기록이에요.
// 바꾸기 직전의 제목과 본문을 쌓아 두고, 되돌리면 하나씩 꺼내요.

export interface Snapshot {
  title: string;
  body: string;
}

/** 기록은 100번까지 남겨요. */
const LIMIT = 100;
/** 같은 칸을 이어서 칠 때 이 시간(ms) 안의 글자들은 한 번으로 묶어요. 한 글자씩 되돌리지 않게요. */
const GROUP_MS = 800;

/**
 * kind: 'title'(제목 치기), 'body'(본문 치기), 'block'(서식 버튼, 사진 넣기처럼 한 번에 바뀌는 것).
 * 'block'은 늘 따로 한 번으로 남겨요.
 */
export type ChangeKind = 'title' | 'body' | 'block';

export function useEditHistory() {
  const [stacks, setStacks] = useState<{ past: Snapshot[]; future: Snapshot[] }>({
    past: [],
    future: [],
  });
  const last = useRef<{ kind: ChangeKind | null; at: number }>({ kind: null, at: 0 });

  /** 바꾸기 전 모습을 남겨요. */
  function remember(before: Snapshot, kind: ChangeKind) {
    const now = Date.now();
    const typing =
      kind !== 'block' && kind === last.current.kind && now - last.current.at < GROUP_MS;
    last.current = { kind, at: now };
    if (typing) return;
    setStacks((s) => ({ past: [...s.past.slice(-(LIMIT - 1)), before], future: [] }));
  }

  /** 되돌려서 보여줄 모습. 되돌릴 게 없으면 null */
  function undo(current: Snapshot): Snapshot | null {
    const previous = stacks.past[stacks.past.length - 1];
    if (!previous) return null;
    setStacks((s) => ({ past: s.past.slice(0, -1), future: [...s.future, current] }));
    last.current = { kind: null, at: 0 };
    return previous;
  }

  /** 다시 하기로 보여줄 모습. 없으면 null */
  function redo(current: Snapshot): Snapshot | null {
    const next = stacks.future[stacks.future.length - 1];
    if (!next) return null;
    setStacks((s) => ({ past: [...s.past, current], future: s.future.slice(0, -1) }));
    last.current = { kind: null, at: 0 };
    return next;
  }

  return {
    remember,
    undo,
    redo,
    canUndo: stacks.past.length > 0,
    canRedo: stacks.future.length > 0,
  };
}
