import type { Note } from '@noteapp/shared';

// 막 쓰기 기록 화면에서 쓰는 순수 함수예요. 메모를 날짜별로 묶고, 날짜와 시각 글자를 만들어요.

/** 하루치 메모 묶음. 날짜는 한 번만 보여주고, 안의 메모는 쓴 순서(오래된 것 먼저)예요. */
export interface NoteDay {
  /** 기기 시간대 기준 날짜. 예: '2026-11-11' */
  key: string;
  notes: Note[];
}

/** 기기 시간대 기준 날짜 열쇠. en-CA 형식이 마침 'YYYY-MM-DD' 모양이라 그대로 써요. */
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

/** 메모를 날짜별로 묶어요. 날짜도, 날짜 안의 메모도 오래된 것부터 쌓여요. */
export function groupByDay(notes: Note[]): NoteDay[] {
  // ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
  const sorted = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const days: NoteDay[] = [];
  for (const note of sorted) {
    const key = dayKey(note.createdAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.notes.push(note);
    else days.push({ key, notes: [note] });
  }
  return days;
}

/** "2026년 11월 11일 수요일"처럼 날짜 구분선에 보여줘요. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

/** "오후 11:15"처럼 메모 옆에 시각만 보여줘요. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}
