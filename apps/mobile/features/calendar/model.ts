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
  score?: number;
  matchedTags?: string[];
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

const FALLBACK_PROTECTED_WORDS = new Set([
  '회의',
  '강의',
  '논의',
  '합의',
  '문의',
  '토의',
  '스터디',
  '회고',
  '정리',
  '요가',
  '휴가',
  '동아리',
]);
const FALLBACK_NOISE_WORDS = new Set([
  '오늘',
  '내일',
  '모레',
  '어제',
  '이번',
  '다음',
  '지난',
  '주간',
  '월간',
  '일간',
  '아침',
  '오전',
  '점심',
  '오후',
  '저녁',
  '새벽',
  '야간',
  '밤',
  '시간',
  '분간',
  '일정',
  '예정',
  '관련',
  '대한',
  '위한',
  '및',
  '또는',
  '그리고',
  '작성',
  '점검',
  '확인',
  '준비',
  '진행',
  '완료',
  '수정',
  '추가',
  '삭제',
  '보내기',
  '하기',
  '잡기',
]);
const FALLBACK_JOSA_RE = /(?:에서|으로|까지|부터|을|를|이|가|은|는|에|의|로|와|과|도|만)$/;

function normalizeTagArray(tags: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const clean = raw.trim().replace(/^#+/, '').toLowerCase();
    if (!clean) continue;
    const tag = `#${clean}`;
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

function fallbackTagsFromTitle(title?: string): string[] {
  if (!title) return [];
  const { cleanTitle, tags } = splitTitleAndTags(title);
  const combined = [...tags];
  const seen = new Set(tags);

  const tokens = cleanTitle
    .toLowerCase()
    .split(/[^0-9a-z\uac00-\ud7a3_]+/i)
    .filter(Boolean);

  for (const raw of tokens) {
    let word = raw;
    if (!FALLBACK_PROTECTED_WORDS.has(word)) {
      const stripped = word.replace(FALLBACK_JOSA_RE, '');
      if (stripped.length >= 2) word = stripped;
    }
    if (word.length < 2 || /^\d+(?:km|m|kg|g|시|분|개|회)?$/i.test(word)) continue;
    if (FALLBACK_NOISE_WORDS.has(word)) continue;
    const tag = `#${word}`;
    if (!seen.has(tag)) {
      seen.add(tag);
      combined.push(tag);
    }
  }
  return combined;
}

interface TitleTimeCue {
  label: string;
  minHour: number;
  maxHour: number;
  centerHour: number;
}

function detectTitleTimeCue(title: string): TitleTimeCue | undefined {
  if (/(새벽|모닝)/.test(title)) {
    return { label: '이른 아침', minHour: 6, maxHour: 9, centerHour: 7.5 };
  }
  if (/아침/.test(title)) {
    return { label: '아침', minHour: 7, maxHour: 10, centerHour: 8.5 };
  }
  if (/오전/.test(title)) {
    return { label: '오전', minHour: 8.5, maxHour: 12, centerHour: 10 };
  }
  if (/(점심|런치)/.test(title)) {
    return { label: '점심', minHour: 11.5, maxHour: 13.5, centerHour: 12.5 };
  }
  if (/오후/.test(title)) {
    return { label: '오후', minHour: 13, maxHour: 18, centerHour: 15 };
  }
  if (/(저녁|퇴근)/.test(title)) {
    return { label: '저녁', minHour: 18, maxHour: 21.5, centerHour: 19.5 };
  }
  if (/(밤|야간)/.test(title)) {
    return { label: '밤', minHour: 20, maxHour: 22, centerHour: 21 };
  }
  return undefined;
}

type ActivityArchetype = 'workout' | 'deep' | 'collab' | 'study' | 'general';

function detectActivityArchetype(tags: readonly string[], title: string): ActivityArchetype {
  const joined = `${tags.join(' ')} ${title.toLowerCase()}`;
  if (
    /(#운동|#러닝|#달리기|#조깅|#헬스|#요가|#필라테스|#스트레칭|#건강|러닝|조깅|헬스|운동|요가|스트레칭)/.test(
      joined,
    )
  ) {
    return 'workout';
  }
  if (
    /(#개발|#백엔드|#프론트엔드|#알고리즘|#성능최적화|#아키텍처|#설계|#코드리뷰|#인공지능|#ai)/.test(
      joined,
    )
  ) {
    return 'deep';
  }
  if (/(#회의|#팀회의|#멘토링|#발표|#기획|#자료검토|견적서|보내기|문의|면담|미팅)/.test(joined)) {
    return 'collab';
  }
  if (/(#스터디|#독서|#회고|#학습일지|#강의|#논문리뷰)/.test(joined)) {
    return 'study';
  }
  return 'general';
}

interface ReferenceProfile {
  id: string;
  day: string;
  fromMs: number;
  toMs: number;
  midHour: number;
  tags: string[];
}

/** 여러 날짜에 걸쳐 해시태그 유사도·시간 맥락·이력을 반영한 맞춤 빈 시간 후보를 추천해요. */
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
    targetTitle?: string;
    targetTags?: readonly string[];
    itemTagsById?: ReadonlyMap<string, readonly string[]>;
  },
): TimeSlot[] {
  const minute = 60000;
  const hourMs = 60 * minute;
  const durationMinutes = Math.max(15, options?.durationMinutes ?? 60);
  const duration = durationMinutes * minute;
  const step = 30 * minute;
  const now = options?.now ?? Date.now();
  const limit = Math.max(1, options?.limit ?? 6);
  const dueMs = options?.dueAt ? Date.parse(options.dueAt) : Infinity;

  const busy = collectBusyIntervals(events, tasks, options?.excludeTaskId);
  if (!busy) return [];

  const targetTitle = options?.targetTitle ?? '';
  const targetTags = normalizeTagArray(
    options?.targetTags && options.targetTags.length > 0
      ? options.targetTags
      : fallbackTagsFromTitle(targetTitle),
  );
  const targetTagSet = new Set(targetTags);
  const titleCue = targetTitle ? detectTitleTimeCue(targetTitle) : undefined;
  const archetype = detectActivityArchetype(targetTags, targetTitle);

  // 제목이나 태그가 이른 아침/늦은 저녁 맥락을 가지면 탐색 창을 자동으로 넓혀요.
  const startHour =
    options?.startHour ??
    (titleCue && titleCue.minHour < 8
      ? Math.floor(titleCue.minHour)
      : archetype === 'workout'
        ? 7
        : 8);
  const endHour =
    options?.endHour ??
    (titleCue && titleCue.maxHour > 21
      ? Math.ceil(titleCue.maxHour)
      : archetype === 'workout' || archetype === 'study'
        ? 22
        : 21);

  const references: ReferenceProfile[] = [];
  const pushRef = (id?: string, title?: string, startAt?: string, endAt?: string) => {
    if (!startAt || !endAt) return;
    const fromMs = Date.parse(startAt);
    const toMs = Date.parse(endAt);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return;
    const refDay = dayKey(startAt);
    const refMidnight = Date.parse(`${refDay}T00:00:00+09:00`);
    const midMs = (fromMs + toMs) / 2;
    const midHour = Math.max(0, Math.min(24, (midMs - refMidnight) / hourMs));
    const provided = id ? options?.itemTagsById?.get(id) : undefined;
    const refTags = normalizeTagArray(
      provided && provided.length > 0 ? provided : fallbackTagsFromTitle(title),
    );
    references.push({
      id: id ?? `${startAt}:${endAt}`,
      day: refDay,
      fromMs,
      toMs,
      midHour,
      tags: refTags,
    });
  };

  for (const event of events) {
    if (!event.allDay) pushRef(event.id, event.title, event.startAt, event.endAt);
  }
  for (const task of tasks) {
    if (
      (options?.excludeTaskId === undefined || task.id !== options.excludeTaskId) &&
      task.status !== 'dismissed'
    ) {
      pushRef(task.id, task.title, task.startAt, task.endAt);
    }
  }

  type RankedCandidate = TimeSlot & { rawScore: number };
  const perDayBest = new Map<string, RankedCandidate[]>();

  for (let dayIdx = 0; dayIdx < days.length; dayIdx += 1) {
    const day = days[dayIdx];
    const midnight = Date.parse(`${day}T00:00:00+09:00`);
    const dayEndMs = midnight + 24 * hourMs;
    const windowStart = Math.max(midnight + startHour * hourMs, now);
    const windowEnd = midnight + endHour * hourMs;
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart >= windowEnd) {
      continue;
    }

    // 하루 전체 점유 시간을 집계해 지나치게 붐비는 날을 피하고 여유 있는 날로 분산해요.
    let dayBusyMs = 0;
    for (const item of busy) {
      const overlapStart = Math.max(midnight, item.from);
      const overlapEnd = Math.min(dayEndMs, item.to);
      if (overlapEnd > overlapStart) dayBusyMs += overlapEnd - overlapStart;
    }
    const dayBusyHours = dayBusyMs / hourMs;
    const dayRefs = references.filter((ref) => ref.day === day);

    const gaps = findDayGaps(windowStart, windowEnd, busy);
    const dayCandidates: RankedCandidate[] = [];

    for (const gap of gaps) {
      const from = midnight + Math.ceil((gap.from - midnight) / step) * step;
      for (let time = from; time + duration <= gap.to; time += step) {
        const endTime = time + duration;
        const hourKst = Math.floor((time - midnight) / hourMs);
        const candMidHour = (time - midnight + duration / 2) / hourMs;
        const pastDue = Number.isFinite(dueMs) && endTime > dueMs;
        const inCoreHours = hourKst >= 9 && hourKst < 18;
        const isCompactGap = gap.to - gap.from < 2 * duration;
        const gapLength = gap.to - gap.from;

        // 1) 과거 일정·할 일과의 해시태그 유사도 및 시간대 근접도 점수 (최대 55점)
        let affinityScore = 0;
        let bestMatchWeight = 0;
        let bestMatchHour = candMidHour;
        const tagWeights = new Map<string, number>();

        if (targetTagSet.size > 0) {
          const contributions: number[] = [];
          for (const ref of references) {
            if (ref.tags.length === 0) continue;
            const overlapTags = ref.tags.filter((tag) => targetTagSet.has(tag));
            if (overlapTags.length === 0) continue;

            const similarity = overlapTags.length / Math.sqrt(targetTagSet.size * ref.tags.length);
            const hourDiff = Math.abs(candMidHour - ref.midHour);
            const timeProximity = Math.exp(-(hourDiff * hourDiff) / 8);
            const pairScore = 45 * similarity * timeProximity;
            contributions.push(pairScore);

            if (pairScore > bestMatchWeight) {
              bestMatchWeight = pairScore;
              bestMatchHour = ref.midHour;
            }
            for (const tag of overlapTags) {
              tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + pairScore);
            }
          }
          contributions.sort((a, b) => b - a);
          let weighted = 0;
          for (let idx = 0; idx < contributions.length; idx += 1) {
            const decay = idx === 0 ? 1 : idx === 1 ? 0.35 : 0.15;
            weighted += contributions[idx] * decay;
          }
          affinityScore = Math.min(55, weighted);
        }

        const matchedTags = [...tagWeights.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag)
          .slice(0, 3);

        // 2) 같은 날 연관 클러스터 및 전후 완충 여백 점수
        let sameDayClusterTag: string | undefined;
        let clusterBonus = 0;
        let bufferDelta = 0;
        let nearestNeighborGap = Infinity;
        let adjacentUnrelated = false;

        for (const ref of dayRefs) {
          const distance =
            endTime <= ref.fromMs ? ref.fromMs - endTime : time >= ref.toMs ? time - ref.toMs : 0;
          const sharesTag = ref.tags.some((tag) => targetTagSet.has(tag));
          if (sharesTag && distance <= 2 * hourMs && !sameDayClusterTag) {
            sameDayClusterTag = ref.tags.find((tag) => targetTagSet.has(tag));
            clusterBonus = 18;
          }
          if (distance < nearestNeighborGap) nearestNeighborGap = distance;
          if (distance === 0 && !sharesTag) adjacentUnrelated = true;
        }
        if (adjacentUnrelated) bufferDelta = -6;
        else if (nearestNeighborGap >= 15 * minute && nearestNeighborGap <= 2 * hourMs) {
          bufferDelta = 4;
        }

        // 3) 제목 시간 단서 + 활동 유형별 선호 시간대 점수
        let cueDelta = 0;
        let cueMatched = false;
        if (titleCue) {
          if (candMidHour >= titleCue.minHour && candMidHour <= titleCue.maxHour) {
            cueMatched = true;
            cueDelta = 35 + 5 * Math.exp(-Math.pow(candMidHour - titleCue.centerHour, 2) / 4);
          } else {
            cueDelta = -12;
          }
        }

        let archetypeDelta = 0;
        let archetypeMatched = false;
        if (archetype === 'workout') {
          if ((hourKst >= 7 && hourKst < 9) || (hourKst >= 18 && hourKst <= 21)) {
            archetypeDelta = 16;
            archetypeMatched = true;
          } else if (hourKst >= 10 && hourKst < 17) {
            archetypeDelta = -8;
          }
        } else if (archetype === 'deep') {
          const morningFocus = candMidHour >= 9.5 && candMidHour < 12;
          const afternoonFocus = candMidHour >= 13.5 && candMidHour < 17.5;
          if ((morningFocus || afternoonFocus) && gapLength >= duration + 30 * minute) {
            archetypeDelta = 14;
            archetypeMatched = true;
          } else if (hourKst >= 20) {
            archetypeDelta = -6;
          }
        } else if (archetype === 'collab') {
          if (
            (candMidHour >= 9.5 && candMidHour < 12) ||
            (candMidHour >= 13.5 && candMidHour < 17.5)
          ) {
            archetypeDelta = 12;
            archetypeMatched = true;
          } else if (hourKst === 12 || hourKst >= 19) {
            archetypeDelta = -8;
          }
        } else if (archetype === 'study') {
          if (hourKst >= 18 && hourKst <= 21) {
            archetypeDelta = 12;
            archetypeMatched = true;
          } else if (inCoreHours) {
            archetypeDelta = 4;
          }
        }

        // 4) 마감 준수·긴급도·하루 밀집도·날짜 오프셋 반영
        let dueDelta = 45;
        if (pastDue) {
          dueDelta = -35;
        } else if (Number.isFinite(dueMs) && dueMs - now <= 36 * hourMs) {
          dueDelta += 14;
        }

        const loadDelta = dayBusyHours >= 5 ? -12 : dayBusyHours < 2 ? 8 : 0;
        const basePosture =
          affinityScore < 6 && !titleCue
            ? inCoreHours
              ? 24
              : hourKst >= 18 && hourKst < 20
                ? 10
                : 0
            : inCoreHours
              ? 8
              : 0;
        const compactBonus = isCompactGap && archetype !== 'deep' ? 4 : 0;
        const dayDecay = -dayIdx * 3.5;
        const hourTie = -((time - midnight) / hourMs) * 0.12;

        const rawScore =
          affinityScore +
          clusterBonus +
          bufferDelta +
          cueDelta +
          archetypeDelta +
          dueDelta +
          loadDelta +
          basePosture +
          compactBonus +
          dayDecay +
          hourTie;

        const displayScore = Math.max(52, Math.min(98, Math.round(54 + (rawScore - 15) * 0.36)));

        let fit: 'good' | 'ok' | 'tight' = 'ok';
        if (pastDue) {
          fit = 'tight';
        } else if (displayScore >= 82 || (affinityScore < 6 && !titleCue && inCoreHours)) {
          fit = 'good';
        } else if (displayScore < 68) {
          fit = 'tight';
        }

        let reason = '오후에 여유 있게 배치할 수 있는 시간대예요.';
        if (pastDue) {
          reason = '마감 이후 시간대이지만 비어 있어요.';
        } else if (affinityScore >= 12 && matchedTags.length > 0) {
          const displayHour = Math.min(23, Math.max(0, Math.round(bestMatchHour)));
          reason = `기존 ${matchedTags.slice(0, 2).join(', ')} 일정과 비슷한 ${displayHour}시 무렵 시간대예요.`;
        } else if (sameDayClusterTag) {
          reason = `같은 날 ${sameDayClusterTag} 일정 전후라 흐름을 이어가기 좋아요.`;
        } else if (titleCue && cueMatched) {
          reason = `제목의 ${titleCue.label} 시간 흐름에 맞춘 빈 시간이에요.`;
        } else if (archetype === 'workout' && archetypeMatched) {
          reason = '운동 루틴을 소화하기 좋은 아침 또는 저녁 빈 시간이에요.';
        } else if (archetype === 'deep' && archetypeMatched) {
          reason = '방해 없이 몰입하기 좋은 연속 빈 시간이에요.';
        } else if (archetype === 'collab' && archetypeMatched) {
          reason = '소통이나 협업을 진행하기 좋은 업무 시간대예요.';
        } else if (archetype === 'study' && archetypeMatched) {
          reason = '차분히 학습하거나 회고하기 좋은 시간대예요.';
        } else if (hourKst < 9) {
          reason = '이른 아침 조용한 빈 시간이에요.';
        } else if (hourKst < 12) {
          reason = '오전 집중하기 좋은 빈 시간이에요.';
        } else if (hourKst < 18) {
          reason = isCompactGap
            ? '일정 사이 빈틈을 알차게 쓰기 좋은 시간이에요.'
            : '오후에 여유 있게 배치할 수 있는 시간대예요.';
        } else {
          reason = '일과 후 차분히 진행하기 좋은 저녁 빈 시간이에요.';
        }

        dayCandidates.push({
          startAt: new Date(time).toISOString(),
          endAt: new Date(endTime).toISOString(),
          day,
          fit,
          score: displayScore,
          reason,
          ...(matchedTags.length > 0 ? { matchedTags } : {}),
          rawScore,
        });
      }
    }

    dayCandidates.sort((a, b) => b.rawScore - a.rawScore || a.startAt.localeCompare(b.startAt));
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
  allSlots.sort((a, b) => b.rawScore - a.rawScore || a.startAt.localeCompare(b.startAt));
  return allSlots.slice(0, limit).map(({ rawScore: _rawScore, ...slot }) => slot);
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

export const MAX_EVENT_TITLE_LENGTH = 200;

/** Supabase calendar_events 테이블 제약(제목 1~200자, 종료 >= 시작)에 맞게 새 일정 입력을 검증해요. */
export function validateCalendarEventInput(input: {
  title: string;
  startAt: string;
  endAt: string;
}): string {
  const trimmed = input.title.trim();
  if (trimmed.length === 0) {
    throw new Error('일정 제목을 입력해 주세요.');
  }
  if (trimmed.length > MAX_EVENT_TITLE_LENGTH) {
    throw new Error(`일정 제목은 ${MAX_EVENT_TITLE_LENGTH}자 이하로 입력해 주세요.`);
  }
  const startMs = Date.parse(input.startAt);
  const endMs = Date.parse(input.endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error('일정 시간 범위를 확인해 주세요.');
  }
  return trimmed;
}

/** 화면 표시를 위해 제목에서 #해시태그를 분리하고 깔끔한 본문만 돌려줘요. 원문은 고치지 않아요. */
export function splitTitleAndTags(title: string): { cleanTitle: string; tags: string[] } {
  const tags = new Set<string>();
  for (const match of title.normalize('NFKC').matchAll(TAG_EXTRACT_RE))
    tags.add(`#${match[1].toLowerCase()}`);
  const cleanTitle = title.replace(TAG_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
  return { cleanTitle: cleanTitle || title.trim(), tags: [...tags] };
}
