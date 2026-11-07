import type { CalendarEvent, Card } from '@noteapp/shared';

// M1 예시 화면의 표시 시간대. 저장은 항상 UTC ISO 문자열을 사용해요.
export const TIMEZONE = 'Asia/Seoul';
export function dayKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map((key) => parts.find((p) => p.type === key)?.value).join('-');
}
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}
export function weekDays(day: string): string[] {
  const weekday = new Date(`${day}T12:00:00+09:00`).getUTCDay();
  const monday = shiftDay(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}
export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}
export function overlaps(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
): boolean {
  return Date.parse(start) < Date.parse(otherEnd) && Date.parse(end) > Date.parse(otherStart);
}
export function eventsOnDay(events: CalendarEvent[], day: string): CalendarEvent[] {
  return events
    .filter((event) =>
      overlaps(
        event.startAt,
        event.endAt,
        `${day}T00:00:00+09:00`,
        `${shiftDay(day, 1)}T00:00:00+09:00`,
      ),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
export interface TimeSlot {
  startAt: string;
  endAt: string;
  reason: string;
}
export function suggestSlots(
  day: string,
  events: CalendarEvent[],
  tasks: Card[],
  dueAt?: string,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  // M1: 업무 시간 내 30분 단위의 빈 시간에서 60분 후보를 최대 3개 골라요.
  for (let minute = 9 * 60; minute <= 17 * 60 && slots.length < 3; minute += 30) {
    const startAt = new Date(Date.parse(`${day}T00:00:00+09:00`) + minute * 60000).toISOString();
    const endAt = new Date(Date.parse(startAt) + 60 * 60000).toISOString();
    if (dueAt && Date.parse(endAt) > Date.parse(dueAt)) continue;
    const busy = [...events, ...tasks.filter((task) => task.startAt && task.endAt)];
    if (
      busy.some(
        (item) => item.startAt && item.endAt && overlaps(startAt, endAt, item.startAt, item.endAt),
      )
    )
      continue;
    if (slots.some((slot) => overlaps(startAt, endAt, slot.startAt, slot.endAt))) continue;
    slots.push({ startAt, endAt, reason: '다른 일정과 겹치지 않는 60분이에요.' });
  }
  return slots;
}
