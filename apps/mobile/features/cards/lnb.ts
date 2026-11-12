import type { Card, CardType } from '@noteapp/shared';

import { rememberText } from './data';
import { addFromText, replaceCards, useCards } from './store';

// 왼쪽 메뉴 카드 섹션의 개수 배지에 쓰는 훅이에요.
export function useWaitingCount() {
  const { cards, loading } = useCards();
  return loading ? undefined : cards.filter((c) => c.status === 'suggested').length;
}

function useTypeCount(type: CardType) {
  const { cards, loading } = useCards();
  return loading
    ? undefined
    : cards.filter((c) => c.type === type && c.status !== 'dismissed').length;
}
export const useEventCount = () => useTypeCount('event');
export const useTaskCount = () => useTypeCount('task');
export const usePersonCount = () => useTypeCount('person');
export const useIdeaCount = () => useTypeCount('idea');

/** 막 쓰기(notes)로 저장한 글에서 카드를 찾고, 사용자에게 보여 줄 한 줄을 돌려줘요. */
export async function findCardsFromMemo(text: string): Promise<string> {
  const { length } = await addFromText(text);
  return length ? `카드 ${length}장을 찾았어요. 아래에서 확인해 주세요.` : '찾은 카드가 없어요.';
}

/**
 * 받아쓴 말(회의록 같은 긴 글)에서 일정·약속·할 일을 찾아 확인 기다리는 카드로 넣어요.
 * 마침표가 없어도 말끝으로 나누고, 지난 이야기는 빼요. 넣은 카드를 돌려줘요.
 */
export const findCardsFromTranscript = (text: string): Promise<Card[]> =>
  addFromText(text, { spoken: true });

/** AI가 받아쓴 글에서 찾은 일정·할 일. 시간은 ISO 8601(시간대 포함), quote는 원문 그대로 */
export interface TranscriptItem {
  type: 'event' | 'task';
  title: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  quote: string;
}

const iso = (v?: string) => {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/**
 * AI가 찾은 일정·할 일로 확인 기다리는 카드를 만들어요. 규칙으로 먼저 찾은 카드(replaced)는 빼요.
 * 원문 위치(span)는 quote를 받아쓴 글에서 찾아서 정해요.
 */
export async function addAiCardsFromTranscript(
  text: string,
  items: TranscriptItem[],
  replaced: string[],
): Promise<Card[]> {
  const noteId = rememberText(text);
  const now = new Date().toISOString();
  const cards = items.flatMap((item, i): Card[] => {
    const title = item.title.trim();
    if (!title) return [];
    const at = item.quote ? text.indexOf(item.quote.trim()) : -1;
    const span: [number, number] = at >= 0 ? [at, at + item.quote.trim().length] : [0, 0];
    const startAt = iso(item.startAt);
    return [
      {
        id: `${noteId}:ai:${item.type}:${i}`,
        type: item.type === 'event' && startAt ? 'event' : 'task',
        status: 'suggested',
        title,
        ...(item.type === 'event' && startAt ? { startAt, endAt: iso(item.endAt) } : {}),
        ...(item.type === 'task' || !startAt ? { dueAt: iso(item.dueAt) ?? startAt } : {}),
        source: { kind: 'note', noteId, span },
        createdAt: now,
      },
    ];
  });
  return replaceCards(replaced, cards);
}
