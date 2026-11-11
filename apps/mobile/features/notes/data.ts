import AsyncStorage from '@react-native-async-storage/async-storage';
import { fixtures, type Note, type NoteReminder } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

// 메모 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일의 함수만 불러요.
// M2: dataSource === 'supabase'면 notes_ 테이블로 바꿔요. 화면은 그대로예요.

// M1에서 새로 쓴 메모. 앱이 켜져 있는 동안만 기억해요(앱을 끄면 사라져요).
const added: Note[] = [];

/** 새 메모를 저장할 때 넘기는 값 */
export interface NewNote {
  text: string;
  reminder?: NoteReminder;
  collaborators?: string[];
}

/** 최근 메모를 최신순으로 돌려줘요. */
export async function listNotes(): Promise<Note[]> {
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');
  const notes = [...added, ...(await fromFixture(fixtures.notes))];
  // ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 메모 원문을 저장해요. 앞뒤 공백만 지우고 내용은 고치지 않아요. */
export async function saveNote({ text, reminder, collaborators }: NewNote): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('빈 메모는 저장하지 않아요.');
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');

  const now = new Date();
  const note: Note = { id: `note-${now.getTime()}`, text: trimmed, createdAt: now.toISOString() };
  if (reminder) note.reminder = reminder;
  if (collaborators?.length) note.collaborators = collaborators;
  added.unshift(note);
  return note;
}

// ── 중요한 메모 ──
// 사용자가 기록에서 별을 누른 메모예요. 지우기 전까지 남아야 해서, 기기 저장소(AsyncStorage)에 원문을 통째로 복사해 둬요.
// AsyncStorage: 앱을 껐다 켜도 남는 기기 안의 작은 저장 공간이에요 (웹에서는 localStorage).
// M2: notes_ 테이블에 중요 표시 열을 두고 그걸로 바꿔요. 화면은 그대로예요.
const IMPORTANT_KEY = 'notes.important';

/** 중요한 메모. 최근에 중요 표시한 것이 위로 와요. */
export async function listImportantNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(IMPORTANT_KEY);
  return raw ? (JSON.parse(raw) as Note[]) : [];
}

/** 메모를 중요한 메모에 넣어요. 이미 있으면 그대로 둬요. */
export async function markImportant(note: Note): Promise<Note[]> {
  const list = await listImportantNotes();
  if (list.some((n) => n.id === note.id)) return list;
  const next = [note, ...list];
  await AsyncStorage.setItem(IMPORTANT_KEY, JSON.stringify(next));
  return next;
}

/** 중요한 메모에서 지워요. 기록에 있는 원래 메모는 그대로예요. */
export async function unmarkImportant(id: string): Promise<Note[]> {
  const next = (await listImportantNotes()).filter((n) => n.id !== id);
  await AsyncStorage.setItem(IMPORTANT_KEY, JSON.stringify(next));
  return next;
}
