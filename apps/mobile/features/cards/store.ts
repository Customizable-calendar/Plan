import type { Card, CardStatus } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { deleteCards, extractFromText, listCards, saveCard, saveCards } from './data';

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

/** 새로 찾은 카드를 맨 앞에 붙이고 저장해요. 저장이 실패하면 다시 빼요. 붙인 카드를 돌려줘요. */
export async function addFromText(text: string, options?: { spoken?: boolean }): Promise<Card[]> {
  await load();
  return addCards(await extractFromText(text, options));
}

/**
 * 확인 기다리는 카드 replaced를 빼고 found로 바꿔요. (받아쓴 글을 AI로 다시 찾았을 때)
 * 이미 확인했거나 버린 카드는 그대로 둬요.
 */
export async function replaceCards(replaced: string[], found: Card[]): Promise<Card[]> {
  await load();
  const drop = new Set(
    (cards ?? [])
      .filter((c) => replaced.includes(c.id) && c.status === 'suggested')
      .map((c) => c.id),
  );
  if (drop.size) {
    const before = cards ?? [];
    cards = before.filter((c) => !drop.has(c.id));
    emit();
    try {
      await deleteCards([...drop]);
    } catch (error) {
      cards = before;
      emit();
      throw error;
    }
  }
  return addCards(found);
}

async function addCards(found: Card[]): Promise<Card[]> {
  if (found.length === 0) return [];
  const ids = new Set(found.map((c) => c.id));
  cards = [...found, ...(cards ?? []).filter((c) => !ids.has(c.id))];
  emit();
  try {
    await saveCards(found);
  } catch (error) {
    cards = (cards ?? []).filter((c) => !ids.has(c.id));
    emit();
    throw error;
  }
  return found;
}

// ---------- 되돌리기 ----------
// 확인·버리기는 한 번 누르면 바로 반영하고, 몇 초 동안 되돌리기를 보여줘요. (확인 창 대신)

export interface Undo {
  label: string;
  changes: { id: string; status: CardStatus }[];
}

const UNDO_MS = 5000;
let undo: Undo | null = null;
let undoTimer: ReturnType<typeof setTimeout> | undefined;

function setUndo(next: Undo | null) {
  clearTimeout(undoTimer);
  undo = next;
  if (next) undoTimer = setTimeout(() => setUndo(null), UNDO_MS);
  emit();
}

export function useUndo() {
  return useSyncExternalStore(subscribe, () => undo);
}

async function setStatus(ids: string[], status: CardStatus, label: string) {
  const changes = (cards ?? [])
    .filter((c) => ids.includes(c.id) && c.status !== status)
    .map((c) => ({ id: c.id, status: c.status }));
  if (changes.length === 0) return;
  setUndo({ label, changes });
  await Promise.all(changes.map((c) => update(c.id, { status })));
}

export async function undoLast() {
  const last = undo;
  if (!last) return;
  setUndo(null);
  await Promise.all(last.changes.map((c) => update(c.id, { status: c.status })));
}

export const confirmCard = (id: string) => setStatus([id], 'confirmed', '확인했어요');
export const dismissCard = (id: string) => setStatus([id], 'dismissed', '버렸어요');
export const confirmCards = (ids: string[]) =>
  setStatus(ids, 'confirmed', `${ids.length}장을 확인했어요`);
export const restoreCard = (id: string) => update(id, { status: 'suggested' });
export const renameCard = (id: string, title: string) => update(id, { title });
