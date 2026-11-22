// 본문 안 위젯 칸들의 글 모양. ```이름 으로 열고 ``` 로 닫아요. 미리보기는 칸마다 전용 화면으로 그려요.
// 글로 저장해서 동기화, 되돌리기, 내보내기가 그대로 되고, 편집 화면에서도 읽을 수 있어요. 화면 없이 쓰는 순수 함수예요.
//
//   ```할일   과목 | 할 일 | 예상 | 실제 | 결과      (tasks.ts)
//   ```시간   06:00-07:30, 21:10-22:00               공부한 시간 (10분 단위)
//   ```결산   컨디션: 좋음                             숫자는 할 일 표와 시간 기록에서 자동으로 모아요
//   ```복습   1일: x / 3일: / 7일:                     x면 가리고 답하기를 했어요

export type WidgetType = 'tasks' | 'time' | 'summary' | 'review';

export const WIDGET_OPEN: Record<string, WidgetType> = {
  '```할일': 'tasks',
  '```시간': 'time',
  '```결산': 'summary',
  '```복습': 'review',
};

export const FENCE_CLOSE = '```';

// ---- 시간 기록: 하루 24시간을 10분 칸 144개로 나눠요. ----

export const SLOTS_PER_HOUR = 6;
export const SLOT_COUNT = 24 * SLOTS_PER_HOUR;

const RANGE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;

function slotOf(hour: number, minute: number): number {
  return hour * SLOTS_PER_HOUR + Math.floor(minute / 10);
}

/** "06:00-07:30, 21:10-22:00" 같은 글을 칠한 칸 번호들로 바꿔요. 끝 시각 칸은 빼요. */
export function parseTime(text: string): Set<number> {
  const slots = new Set<number>();
  for (const m of text.matchAll(RANGE)) {
    const from = slotOf(Number(m[1]), Number(m[2]));
    const to = slotOf(Number(m[3]), Number(m[4]));
    for (let s = from; s < Math.min(to, SLOT_COUNT); s++) slots.add(s);
  }
  return slots;
}

function clock(slot: number): string {
  const h = Math.floor(slot / SLOTS_PER_HOUR);
  const m = (slot % SLOTS_PER_HOUR) * 10;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 칠한 칸들을 이어진 구간 글로 써요. 예: 06:00-07:30, 21:10-22:00 */
export function timeLine(slots: Set<number>): string {
  const sorted = [...slots].filter((s) => s >= 0 && s < SLOT_COUNT).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = -1;
  sorted.forEach((s, i) => {
    if (start === -1) start = s;
    if (sorted[i + 1] !== s + 1) {
      ranges.push(`${clock(start)}-${clock(s + 1)}`);
      start = -1;
    }
  });
  return ranges.join(', ');
}

/** 분을 "2시간 30분"으로 */
export function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

// ---- 결산: 컨디션 ----

export const CONDITIONS = ['아주 좋음', '좋음', '보통', '피곤', '아주 피곤'] as const;

export function parseCondition(lines: string[]): string {
  for (const l of lines) {
    const m = /^컨디션:\s*(.*)$/.exec(l.trim());
    if (m) return m[1].trim();
  }
  return '';
}

// ---- 복습: 1일, 3일, 7일 전 일지 ----

export const REVIEW_DAYS = [1, 3, 7] as const;

/** 복습 칸 글에서 날마다 했는지(x) 읽어요. */
export function parseReview(lines: string[]): Record<number, boolean> {
  const done: Record<number, boolean> = {};
  for (const l of lines) {
    const m = /^(\d+)일:\s*(.*)$/.exec(l.trim());
    if (m) done[Number(m[1])] = /^x$/i.test(m[2].trim());
  }
  return done;
}

export function reviewLines(done: Record<number, boolean>): string[] {
  return REVIEW_DAYS.map((d) => `${d}일: ${done[d] ? 'x' : ''}`.trimEnd());
}

// ---- 날짜 ----

/** "2026년 11월 25일 수", "2026-11-25" 같은 글에서 날짜를 읽어요. 못 읽으면 null */
export function parseDay(text: string): Date | null {
  const ko = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(text);
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const m = ko ?? iso;
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 그 날 0시 기준 날짜 열쇠 (같은 날인지 비교할 때) */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** 오늘에서 그날까지 남은 날. 지났으면 음수 */
export function daysUntil(target: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 본문의 "- 이름: 값" 칸 값. 없으면 빈 글 */
export function fieldValue(body: string, label: string): string {
  // 칸 값은 그 줄 안에서만 읽어요. (\s를 쓰면 빈 칸일 때 줄바꿈을 넘어 다음 줄까지 읽어 버려요)
  const m = new RegExp(`^- ${label}:[ \\t]*(.*)$`, 'm').exec(body);
  return m ? m[1].trim() : '';
}
