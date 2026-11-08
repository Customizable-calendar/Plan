import { fixtures, type Note } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

// 메모 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일의 함수만 불러요.
// M2: dataSource === 'supabase'면 notes_ 테이블로 바꿔요. 화면은 그대로예요.

// M1에서 새로 쓴 메모. 앱이 켜져 있는 동안만 기억해요(앱을 끄면 사라져요).
const added: Note[] = [];

/** 최근 메모를 최신순으로 돌려줘요. */
export async function listNotes(): Promise<Note[]> {
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');
  const notes = [...added, ...(await fromFixture(fixtures.notes))];
  // ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 메모 원문을 저장해요. 앞뒤 공백만 지우고 내용은 고치지 않아요. */
export async function saveNote(text: string): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('빈 메모는 저장하지 않아요.');
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');

  const now = new Date();
  const note: Note = { id: `note-${now.getTime()}`, text: trimmed, createdAt: now.toISOString() };
  added.unshift(note);
  return note;
}
