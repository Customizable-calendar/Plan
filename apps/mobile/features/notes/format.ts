import type { NoteReminder } from '@noteapp/shared';

// 화면에 보여주는 글자 모양과 체크리스트 변환을 모아 둔 곳이에요. 화면 없이 쓸 수 있는 순수 함수만 둬요.

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

// "- [ ] 할 일" / "- [x] 한 일" 줄을 찾는 정규식(글자 패턴)이에요.
const CHECK_LINE = /^- \[( |x)\] (.*)$/;

/** 줄바꿈마다 체크 항목 하나로 바꿔요. 빈 줄은 버려요. */
export function textToChecklist(text: string): ChecklistItem[] {
  const items = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = CHECK_LINE.exec(line);
      return m ? { text: m[2], checked: m[1] === 'x' } : { text: line, checked: false };
    });
  return items.length ? items : [{ text: '', checked: false }];
}

/** 체크리스트를 다시 일반 글로 돌려요 (체크 표시는 빠져요). */
export function checklistToPlain(items: ChecklistItem[]): string {
  return items.map((i) => i.text).join('\n');
}

/** 저장할 때 쓰는 모양. 마크다운 체크 줄로 남겨서 원문만 봐도 알 수 있어요. */
export function checklistToText(items: ChecklistItem[]): string {
  return items
    .filter((i) => i.text.trim())
    .map((i) => `- [${i.checked ? 'x' : ' '}] ${i.text.trim()}`)
    .join('\n');
}

/** 저장된 원문이 체크리스트면 항목으로, 아니면 null */
export function parseChecklist(text: string): ChecklistItem[] | null {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length || !lines.every((l) => CHECK_LINE.test(l.trim()))) return null;
  return textToChecklist(text);
}

/** 기기 시간대 이름. 예: 'Asia/Seoul' */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 날짜 하나를 가리키는 열쇠. 기기 시간 기준 "2026-11-15" 모양이에요. */
export function dayKeyOf(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** 고른 날짜들의 hour시 정각을 리마인드로 만들어요. 날짜 순서로 돌려줘요. (기기 시간 기준) */
export function makeReminders(dayKeys: string[], hour: number): NoteReminder[] {
  const timeZone = deviceTimeZone();
  return [...dayKeys].sort().map((key) => {
    const [year, month, day] = key.split('-').map(Number);
    return { at: new Date(year, month - 1, day, hour).toISOString(), timeZone };
  });
}

/**
 * 달력 한 달을 주 단위로 나눠요. 일요일부터 시작하고, 그 달이 아닌 칸은 null이에요.
 * month는 0(1월)부터 11(12월)이에요.
 */
export function monthWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1).getDay(); // 1일의 요일 (0 = 일요일)
  const lastDay = new Date(year, month + 1, 0).getDate(); // 다음 달 0일 = 이번 달 마지막 날
  const cells: (Date | null)[] = Array.from({ length: first }, () => null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "10월 27일 오후 2:00"처럼 리마인드에 저장한 시간대로 보여줘요. */
export function formatReminder({ at, timeZone }: NoteReminder): string {
  return new Date(at).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/** 리마인드 여러 개를 한 줄로. 가장 이른 것 하나와 나머지 개수를 보여줘요. */
export function formatReminders(reminders: NoteReminder[]): string {
  const sorted = [...reminders].sort((a, b) => a.at.localeCompare(b.at));
  const first = formatReminder(sorted[0]);
  return sorted.length > 1 ? `${first} 외 ${sorted.length - 1}개` : first;
}

/** "10월 26일 오전 10:00"처럼 기기 시간대로 보여줘요. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 간단한 이메일 모양 검사 (실제 메일이 있는지는 몰라요) */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
