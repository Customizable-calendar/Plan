import type { Card, CardType } from '@noteapp/shared';

import { addFromText, useCards } from './store';

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
