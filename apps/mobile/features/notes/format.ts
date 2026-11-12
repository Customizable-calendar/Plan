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

/** daysFromToday일 뒤 hour시 정각을 리마인드로 만들어요. (기기 시간 기준) */
export function makeReminder(daysFromToday: number, hour: number): NoteReminder {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, 0, 0, 0);
  return { at: d.toISOString(), timeZone: deviceTimeZone() };
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
