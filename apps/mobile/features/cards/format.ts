import type { Card, CardType } from '@noteapp/shared';

export const typeLabel: Record<CardType, string> = {
  event: '일정',
  task: '할 일',
  person: '사람',
  idea: '아이디어',
};

// TODO(B, M2): 사용자 설정의 시간대로 바꿔요. 지금은 예시 데이터에 맞춰 서울 기준이에요.
const timeZone = 'Asia/Seoul';

const dateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const time = new Intl.DateTimeFormat('ko-KR', { timeZone, hour: 'numeric', minute: '2-digit' });

/** 카드 제목 아래에 보여 줄 한 줄. 일정은 시각, 할 일은 마감, 나머지는 없음 */
export function cardDetail(card: Card): string | undefined {
  if (card.type === 'event' && card.startAt) {
    const start = dateTime.format(new Date(card.startAt));
    return card.endAt ? `${start} ~ ${time.format(new Date(card.endAt))}` : start;
  }
  if (card.type === 'task' && card.dueAt) return `${dateTime.format(new Date(card.dueAt))}까지`;
  return undefined;
}
