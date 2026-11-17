import type { CalendarEvent, Card } from '@noteapp/shared';

// M1 예시 화면의 표시 시간대. 저장은 항상 UTC ISO 문자열을 사용해요.
export const TIMEZONE = 'Asia/Seoul';

const DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const TAG_EXTRACT_RE = /(?:^|[^\p{L}\p{M}\p{N}_/#.-])#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*)/gu;
const TAG_STRIP_RE = /(?:^|\s+)#([\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*)/gu;

export function dayKey(value: string | Date): string {
  const parts = DAY_FORMATTER.formatToParts(new Date(value));
  return ['year', 'month', 'day'].map((key) => parts.find((p) => p.type === key)?.value).join('-');
}

export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}

export function shiftMonth(monthStart: string, amount: number): string {
  const date = new Date(monthStart + 'T12:00:00+09:00');
  date.setUTCMonth(date.getUTCMonth() + amount, 1);
  return dayKey(date);
}

export function weekDays(day: string): string[] {
  const weekday = new Date(`${day}T12:00:00+09:00`).getUTCDay();
  const monday = shiftDay(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

export function timeLabel(value: string): string {
  return TIME_FORMATTER.format(new Date(value));
}

export function overlaps(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
): boolean {
  return Date.parse(start) < Date.parse(otherEnd) && Date.parse(end) > Date.parse(otherStart);
}

export function eventsOnDay(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  const startMs = Date.parse(`${day}T00:00:00+09:00`);
  const endMs = Date.parse(`${shiftDay(day, 1)}T00:00:00+09:00`);
  return events
    .filter((event) => Date.parse(event.startAt) < endMs && Date.parse(event.endAt) > startMs)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** 달력 칸(월·주) 렌더링에서 반복 Date.parse 스캔을 없애기 위해 날짜별로 한 번에 묶어요. */
export function groupEventsByDay(
  events: readonly CalendarEvent[],
  days: readonly string[],
): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  if (!days.length) return grouped;

  const uniqueDays: string[] = [];
  for (const d of days) {
    if (!grouped.has(d)) {
      grouped.set(d, []);
      uniqueDays.push(d);
    }
  }

  const bounds = uniqueDays.map((day) => ({
    startMs: Date.parse(`${day}T00:00:00+09:00`),
    endMs: Date.parse(`${shiftDay(day, 1)}T00:00:00+09:00`),
    list: grouped.get(day)!,
  }));

  const sorted = [...events].sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (const event of sorted) {
    const startMs = Date.parse(event.startAt);
    const endMs = Date.parse(event.endAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    for (const bucket of bounds) {
      if (startMs < bucket.endMs && endMs > bucket.startMs) bucket.list.push(event);
    }
  }
  return grouped;
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
  now = Date.now(),
): TimeSlot[] {
  const minute = 60000;
  const duration = 60 * minute;
  const step = 15 * minute;
  const midnight = Date.parse(day + 'T00:00:00+09:00');
  const start = Math.max(midnight + 9 * 60 * minute, now);
  const end = Math.min(midnight + 18 * 60 * minute, dueAt ? Date.parse(dueAt) : Infinity);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

  // 시작 순으로 훑어 겹친 일정을 합치고 그 사이의 빈 구간을 구해요.
  const busy = [...events, ...tasks.filter((task) => task.status !== 'dismissed')]
    .filter((item) => item.startAt && item.endAt)
    .map((item) => ({ from: Date.parse(item.startAt!), to: Date.parse(item.endAt!) }));
  if (
    busy.some(
      (item) => !Number.isFinite(item.from) || !Number.isFinite(item.to) || item.to < item.from,
    )
  )
    return [];
  busy.sort((a, b) => a.from - b.from);
  const gaps: { from: number; to: number }[] = [];
  let cursor = start;
  for (const item of busy) {
    if (item.to <= cursor || item.from >= end) continue;
    if (item.from > cursor) gaps.push({ from: cursor, to: item.from });
    cursor = Math.max(cursor, item.to);
  }
  if (cursor < end) gaps.push({ from: cursor, to: end });

  // Best fit: 작은 빈 구간부터 채워 긴 빈 시간을 남겨요. 길이가 같으면 이른 순서예요.
  const candidates: { from: number; gapLength: number }[] = [];
  for (const gap of gaps) {
    const from = midnight + Math.ceil((gap.from - midnight) / step) * step;
    for (let time = from; time + duration <= gap.to; time += step) {
      candidates.push({ from: time, gapLength: gap.to - gap.from });
    }
  }
  candidates.sort((a, b) => a.gapLength - b.gapLength || a.from - b.from);
  const slots: TimeSlot[] = [];
  for (const candidate of candidates) {
    const startAt = new Date(candidate.from).toISOString();
    const endAt = new Date(candidate.from + duration).toISOString();
    if (slots.some((slot) => overlaps(startAt, endAt, slot.startAt, slot.endAt))) continue;
    slots.push({
      startAt,
      endAt,
      reason:
        candidate.gapLength < 2 * duration
          ? '짧은 빈 구간을 활용해 긴 빈 시간을 남겨요.'
          : '기존 일정과 겹치지 않는 연속 60분이에요.',
    });
    if (slots.length === 3) break;
  }
  return slots;
}

/** 화면 표시를 위해 제목에서 #해시태그를 분리하고 깔끔한 본문만 돌려줘요. 원문은 고치지 않아요. */
export function splitTitleAndTags(title: string): { cleanTitle: string; tags: string[] } {
  const tags = new Set<string>();
  for (const match of title.normalize('NFKC').matchAll(TAG_EXTRACT_RE))
    tags.add(`#${match[1].toLowerCase()}`);
  const cleanTitle = title.replace(TAG_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
  return { cleanTitle: cleanTitle || title.trim(), tags: [...tags] };
}
