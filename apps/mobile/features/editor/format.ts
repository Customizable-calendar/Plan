import type { CalendarEvent, Document } from '@noteapp/shared';

// TODO(A, M2): 사용자 설정의 시간대로 바꿔요.
const timezone = 'Asia/Seoul';

/** "10/24" */
export function monthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

/** "2026년 10월 24일 (토)" */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(iso));
}

/** "오후 3:05" (임시 저장 시각) */
export function savedTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** 슬래시 명령으로 넣는 일정 한 줄. 일정 자체의 시간대로 보여줘요. */
export function eventLine(event: CalendarEvent): string {
  const when = event.allDay
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: event.timezone,
        month: 'numeric',
        day: 'numeric',
      })
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: event.timezone,
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
  return `📅 ${when.format(new Date(event.startAt))} ${event.title}`;
}

/**
 * 작성 방식. 카드로 초안을 만들었으면 AI 초안, 그 뒤에 고쳤으면 직접 수정이에요.
 * TODO(A, M2): Document에 작성 방식을 따로 저장하면 그 값을 써요. (contract)
 */
export function writingMethod(document: Document): string {
  const fromAi = document.cardIds.length > 0;
  const edited = document.updatedAt !== document.createdAt;
  if (fromAi) return edited ? 'AI 초안 + 직접 수정' : 'AI 초안';
  return '직접 작성';
}
