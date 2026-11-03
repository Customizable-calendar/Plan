import type { Card } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { listCards, saveCard } from './data';

// 카드 탭과 오늘 화면 섹션이 같은 카드 목록을 보도록 한곳에 둬요.
// useSyncExternalStore: 컴포넌트 밖의 값이 바뀌면 그 값을 쓰는 화면을 다시 그려요.

let cards: Card[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  loading ??= listCards().then((list) => {
    cards = list;
    emit();
  });
  return loading;
}

export function useCards() {
  useEffect(() => {
    void load();
  }, []);
  const snapshot = useSyncExternalStore(subscribe, () => cards);
  return { cards: snapshot ?? [], loading: snapshot === null };
}

/** 화면을 먼저 바꾸고 저장해요. 저장이 실패하면 원래대로 돌려요. */
async function update(id: string, patch: Partial<Pick<Card, 'status' | 'title'>>) {
  const before = cards?.find((c) => c.id === id);
  if (!cards || !before) return;
  const after = { ...before, ...patch };
  cards = cards.map((c) => (c.id === id ? after : c));
  emit();
  try {
    await saveCard(after);
  } catch (error) {
    cards = cards.map((c) => (c.id === id ? before : c));
    emit();
    throw error;
  }
}

export const confirmCard = (id: string) => update(id, { status: 'confirmed' });
export const dismissCard = (id: string) => update(id, { status: 'dismissed' });
export const restoreCard = (id: string) => update(id, { status: 'suggested' });
export const renameCard = (id: string, title: string) => update(id, { title });
