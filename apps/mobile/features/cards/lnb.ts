import type { CardType } from '@noteapp/shared';

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
  const count = await addFromText(text);
  return count ? `카드 ${count}장을 찾았어요. 아래에서 확인해 주세요.` : '찾은 카드가 없어요.';
}
