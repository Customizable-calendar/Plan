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
  fit?: 'good' | 'ok' | 'tight';
  day?: string;
}

export interface HourAvailability {
  hour: number;
  busy: boolean;
  eventCount: number;
  taskCount: number;
}

function collectBusyIntervals(
  events: readonly CalendarEvent[],
  tasks: readonly Card[],
  excludeTaskId?: string,
): { from: number; to: number }[] | undefined {
  const busy = [
    ...events,
    ...tasks.filter(
      (task) =>
        (excludeTaskId === undefined || task.id !== excludeTaskId) && task.status !== 'dismissed',
    ),
  ]
    .filter((item) => item.startAt && item.endAt)
    .map((item) => ({ from: Date.parse(item.startAt!), to: Date.parse(item.endAt!) }));

  if (
    busy.some(
      (item) => !Number.isFinite(item.from) || !Number.isFinite(item.to) || item.to < item.from,
    )
  ) {
    return undefined;
  }
  busy.sort((a, b) => a.from - b.from);
  return busy;
}

function findDayGaps(
  start: number,
  end: number,
  busy: readonly { from: number; to: number }[],
): { from: number; to: number }[] {
  const gaps: { from: number; to: number }[] = [];
  let cursor = start;
  for (const item of busy) {
    if (item.to <= cursor || item.from >= end) continue;
    if (item.from > cursor) gaps.push({ from: cursor, to: item.from });
    cursor = Math.max(cursor, item.to);
  }
  if (cursor < end) gaps.push({ from: cursor, to: end });
  return gaps;
}

export function suggestSlots(
  day: string,
  events: CalendarEvent[],
  tasks: Card[],
  dueAt?: string,
  now = Date.now(),
  durationMinutes = 60,
): TimeSlot[] {
  const minute = 60000;
  const duration = Math.max(15, durationMinutes) * minute;
  const step = 15 * minute;
  const midnight = Date.parse(day + 'T00:00:00+09:00');
  const start = Math.max(midnight + 9 * 60 * minute, now);
  const end = Math.min(midnight + 18 * 60 * minute, dueAt ? Date.parse(dueAt) : Infinity);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

  const busy = collectBusyIntervals(events, tasks);
  if (!busy) return [];
  const gaps = findDayGaps(start, end, busy);

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
    const isCompactGap = candidate.gapLength < 2 * duration;
    slots.push({
      startAt,
      endAt,
      day,
      fit: isCompactGap ? 'good' : 'ok',
      reason: isCompactGap
        ? '짧은 빈 구간을 활용해 긴 빈 시간을 남겨요.'
        : `기존 일정과 겹치지 않는 연속 ${durationMinutes}분이에요.`,
    });
    if (slots.length === 3) break;
  }
  return slots;
}

/** 여러 날짜에 걸쳐 빈 시간 후보를 찾아 추천해요 (08시 ~ 21시). */
export function suggestSlotsAcrossDays(
  days: readonly string[],
  events: CalendarEvent[],
  tasks: Card[],
  options?: {
    dueAt?: string;
    now?: number;
    durationMinutes?: number;
    limit?: number;
    startHour?: number;
    endHour?: number;
    excludeTaskId?: string;
  },
): TimeSlot[] {
  const minute = 60000;
  const durationMinutes = Math.max(15, options?.durationMinutes ?? 60);
  const duration = durationMinutes * minute;
  const step = 30 * minute;
  const now = options?.now ?? Date.now();
  const limit = Math.max(1, options?.limit ?? 6);
  const startHour = options?.startHour ?? 8;
  const endHour = options?.endHour ?? 21;
  const dueMs = options?.dueAt ? Date.parse(options.dueAt) : Infinity;

  const busy = collectBusyIntervals(events, tasks, options?.excludeTaskId);
  if (!busy) return [];

  type RankedCandidate = TimeSlot & { score: number };
  const perDayBest = new Map<string, RankedCandidate[]>();

  for (let dayIdx = 0; dayIdx < days.length; dayIdx += 1) {
    const day = days[dayIdx];
    const midnight = Date.parse(`${day}T00:00:00+09:00`);
    const windowStart = Math.max(midnight + startHour * 60 * minute, now);
    const windowEnd = midnight + endHour * 60 * minute;
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart >= windowEnd) {
      continue;
    }

    const gaps = findDayGaps(windowStart, windowEnd, busy);
    const dayCandidates: RankedCandidate[] = [];

    for (const gap of gaps) {
      const from = midnight + Math.ceil((gap.from - midnight) / step) * step;
      for (let time = from; time + duration <= gap.to; time += step) {
        const hourKst = Math.floor((time - midnight) / (60 * minute));
        const endTime = time + duration;
        const pastDue = Number.isFinite(dueMs) && endTime > dueMs;
        const inCoreHours = hourKst >= 9 && hourKst < 18;
        const isCompactGap = gap.to - gap.from < 2 * duration;

        let fit: 'good' | 'ok' | 'tight' = 'ok';
        if (pastDue || hourKst >= 20 || hourKst < 9) {
          fit = 'tight';
        } else if (inCoreHours) {
          fit = 'good';
        }

        let reason = '오후 여유 있는 빈 시간이에요.';
        if (pastDue) {
          reason = '마감 이후이지만 비어 있는 시간이에요.';
        } else if (hourKst < 9) {
          reason = '이른 아침 조용한 빈 시간이에요.';
        } else if (hourKst < 12) {
          reason = '오전 집중하기 좋은 빈 시간이에요.';
        } else if (hourKst < 18) {
          reason = isCompactGap
            ? '일정 사이 딱 맞는 빈 시간이에요.'
            : '오후 여유 있는 빈 시간이에요.';
        } else {
          reason = '일과 후 저녁 빈 시간이에요.';
        }

        // 마감 준수, 핵심 업무 시간대, 적정 여백, 빠른 날짜 순으로 점수를 매겨요.
        let score = 0;
        if (!pastDue) score += 100;
        if (inCoreHours) score += 40;
        else if (hourKst >= 18 && hourKst < 20) score += 20;
        if (isCompactGap) score += 15;
        if (hourKst >= 9 && hourKst <= 11) score += 10;
        score -= dayIdx * 6;
        score -= ((time - midnight) / (60 * minute)) * 0.2;

        dayCandidates.push({
          startAt: new Date(time).toISOString(),
          endAt: new Date(endTime).toISOString(),
          day,
          fit,
          reason,
          score,
        });
      }
    }

    dayCandidates.sort((a, b) => b.score - a.score || a.startAt.localeCompare(b.startAt));
    const chosenForDay: RankedCandidate[] = [];
    const maxPerDay = days.length > 1 ? 2 : limit;
    for (const candidate of dayCandidates) {
      if (
        chosenForDay.some((s) => overlaps(candidate.startAt, candidate.endAt, s.startAt, s.endAt))
      ) {
        continue;
      }
      chosenForDay.push(candidate);
      if (chosenForDay.length >= maxPerDay) break;
    }
    if (chosenForDay.length > 0) {
      perDayBest.set(day, chosenForDay);
    }
  }

  const allSlots = [...perDayBest.values()].flat();
  allSlots.sort((a, b) => b.score - a.score || a.startAt.localeCompare(b.startAt));
  return allSlots.slice(0, limit).map(({ score: _score, ...slot }) => slot);
}

/** 특정 날짜의 08시 ~ 21시 시간대별 일정/할 일 점유 현황을 계산해요. */
export function busyHoursOnDay(
  day: string,
  events: CalendarEvent[],
  tasks: Card[],
  options?: {
    startHour?: number;
    endHour?: number;
    excludeTaskId?: string;
  },
): HourAvailability[] {
  const startHour = options?.startHour ?? 8;
  const endHour = options?.endHour ?? 21;
  const minute = 60000;
  const midnight = Date.parse(`${day}T00:00:00+09:00`);
  if (!Number.isFinite(midnight)) return [];

  const activeTasks = tasks.filter(
    (task) =>
      (options?.excludeTaskId === undefined || task.id !== options.excludeTaskId) &&
      task.status !== 'dismissed' &&
      task.startAt &&
      task.endAt,
  );

  const result: HourAvailability[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const fromIso = new Date(midnight + hour * 60 * minute).toISOString();
    const toIso = new Date(midnight + (hour + 1) * 60 * minute).toISOString();
    const eventCount = events.filter((event) =>
      overlaps(fromIso, toIso, event.startAt, event.endAt),
    ).length;
    const taskCount = activeTasks.filter(
      (task) => task.startAt && task.endAt && overlaps(fromIso, toIso, task.startAt, task.endAt),
    ).length;
    result.push({
      hour,
      busy: eventCount + taskCount > 0,
      eventCount,
      taskCount,
    });
  }
  return result;
}

/** 화면 표시를 위해 제목에서 #해시태그를 분리하고 깔끔한 본문만 돌려줘요. 원문은 고치지 않아요. */
export function splitTitleAndTags(title: string): { cleanTitle: string; tags: string[] } {
  const tags = new Set<string>();
  for (const match of title.normalize('NFKC').matchAll(TAG_EXTRACT_RE))
    tags.add(`#${match[1].toLowerCase()}`);
  const cleanTitle = title.replace(TAG_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
  return { cleanTitle: cleanTitle || title.trim(), tags: [...tags] };
}
