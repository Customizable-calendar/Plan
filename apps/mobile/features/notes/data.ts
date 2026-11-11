import AsyncStorage from '@react-native-async-storage/async-storage';
import { fixtures, type Note } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

import { textToChecklist, type ChecklistItem } from './format';

// 메모 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일의 함수만 불러요.
// M2: dataSource === 'supabase'면 notes_ 테이블로 바꿔요. 화면은 그대로예요.

// ── 기기 저장소 ──
// AsyncStorage: 앱을 껐다 켜도 남는 기기 안의 작은 저장 공간이에요 (웹에서는 localStorage).
// 지우기 전까지 남아야 하는 것(중요한 메모, 휴지통, 체크리스트)은 여기에 둬요.
const KEYS = {
  important: 'notes.important',
  trash: 'notes.trash',
  /** 기록에서 빼낸 메모 id (휴지통이나 체크리스트로 옮긴 것) */
  hidden: 'notes.hidden',
  checklists: 'notes.checklists',
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function write<T>(key: string, value: T): Promise<T> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  return value;
}

async function hide(id: string) {
  const hidden = await read<string[]>(KEYS.hidden, []);
  if (!hidden.includes(id)) await write(KEYS.hidden, [...hidden, id]);
}

async function unhide(id: string) {
  await write(
    KEYS.hidden,
    (await read<string[]>(KEYS.hidden, [])).filter((x) => x !== id),
  );
}

// ── 기록 ──
// M1에서 새로 쓰거나 고친 메모. 앱이 켜져 있는 동안만 기억해요(앱을 끄면 사라져요).
const added: Note[] = [];
const edited = new Map<string, Note>();

/** 새 메모를 저장할 때 넘기는 값 */
export interface NewNote {
  text: string;
}

/** 기록에 있는 메모를 최신순으로 돌려줘요. 휴지통이나 체크리스트로 옮긴 메모는 빼요. */
export async function listNotes(): Promise<Note[]> {
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');
  const hidden = await read<string[]>(KEYS.hidden, []);
  const notes = [...added, ...(await fromFixture(fixtures.notes))]
    .map((n) => edited.get(n.id) ?? n)
    .filter((n) => !hidden.includes(n.id));
  // ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 메모 원문을 저장해요. 앞뒤 공백만 지우고 내용은 고치지 않아요. */
export async function saveNote({ text }: NewNote): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('빈 메모는 저장하지 않아요.');
  if (dataSource !== 'fixtures') throw new Error('notes: Supabase 연결은 M2에서 만들어요.');

  const now = new Date();
  const note: Note = { id: `note-${now.getTime()}`, text: trimmed, createdAt: now.toISOString() };
  added.unshift(note);
  return note;
}

/** 꾹 눌러 정한 리마인드, 공동 작업자, 해시태그를 저장해요. 중요한 메모에 있으면 거기도 고쳐요. */
export async function updateNote(note: Note): Promise<Note> {
  edited.set(note.id, note);
  const important = await read<Note[]>(KEYS.important, []);
  if (important.some((n) => n.id === note.id)) {
    await write(
      KEYS.important,
      important.map((n) => (n.id === note.id ? note : n)),
    );
  }
  return note;
}

// ── 중요한 메모 ──
// 사용자가 기록에서 별을 누른 메모예요. 원문을 통째로 복사해 둬요.
// M2: notes_ 테이블에 중요 표시 열을 두고 그걸로 바꿔요.

/** 중요한 메모. 최근에 중요 표시한 것이 위로 와요. */
export async function listImportantNotes(): Promise<Note[]> {
  return read<Note[]>(KEYS.important, []);
}

/** 메모를 중요한 메모에 넣어요. 이미 있으면 그대로 둬요. */
export async function markImportant(note: Note): Promise<Note[]> {
  const list = await listImportantNotes();
  if (list.some((n) => n.id === note.id)) return list;
  return write(KEYS.important, [note, ...list]);
}

/** 중요한 메모에서 지워요. 기록에 있는 원래 메모는 그대로예요. */
export async function unmarkImportant(id: string): Promise<Note[]> {
  return write(
    KEYS.important,
    (await listImportantNotes()).filter((n) => n.id !== id),
  );
}

// ── 휴지통 ──
// 왼쪽으로 넘긴 메모는 바로 지우지 않고 여기에 보관해요. 되돌리거나 완전히 지울 수 있어요.

export interface TrashedNote {
  note: Note;
  /** 휴지통에 넣은 시각. ISO 8601 (UTC) */
  trashedAt: string;
}

export async function listTrash(): Promise<TrashedNote[]> {
  return read<TrashedNote[]>(KEYS.trash, []);
}

/** 메모를 기록에서 빼서 휴지통에 넣어요. */
export async function trashNote(note: Note): Promise<void> {
  await hide(note.id);
  await write(KEYS.trash, [{ note, trashedAt: new Date().toISOString() }, ...(await listTrash())]);
}

/** 휴지통에서 꺼내 기록으로 되돌려요. */
export async function restoreNote(id: string): Promise<TrashedNote[]> {
  const trash = await listTrash();
  const item = trash.find((t) => t.note.id === id);
  // 앱을 껐다 켜서 기록에서 사라진 메모면 다시 붙여요.
  if (item && !added.some((n) => n.id === id) && !fixtures.notes.some((n) => n.id === id)) {
    added.push(item.note);
  }
  await unhide(id);
  return write(
    KEYS.trash,
    trash.filter((t) => t.note.id !== id),
  );
}

/** 휴지통에서 완전히 지워요. 되돌릴 수 없어요. */
export async function deleteForever(id: string): Promise<TrashedNote[]> {
  return write(
    KEYS.trash,
    (await listTrash()).filter((t) => t.note.id !== id),
  );
}

// ── 체크리스트 ──
// 꾹 눌러 "체크리스트로 만들기"를 한 메모는 기록에서 빠지고, 막 쓰기 바로 아래에 체크리스트로 보여요.

export interface NoteChecklist {
  id: string;
  items: ChecklistItem[];
  /** 어느 메모에서 왔는지. 원문은 고치지 않고 그대로 남겨요. */
  source: Note;
  createdAt: string;
}

export async function listChecklists(): Promise<NoteChecklist[]> {
  return read<NoteChecklist[]>(KEYS.checklists, []);
}

/** 메모를 기록에서 빼서 체크리스트로 옮겨요. 줄마다 항목 하나가 돼요. */
export async function moveToChecklist(note: Note): Promise<void> {
  const now = new Date();
  const checklist: NoteChecklist = {
    id: `checklist-${now.getTime()}`,
    items: textToChecklist(note.text),
    source: note,
    createdAt: now.toISOString(),
  };
  await hide(note.id);
  await write(KEYS.checklists, [checklist, ...(await listChecklists())]);
}

/** 항목을 체크하거나 풀어요. */
export async function updateChecklist(checklist: NoteChecklist): Promise<NoteChecklist[]> {
  return write(
    KEYS.checklists,
    (await listChecklists()).map((c) => (c.id === checklist.id ? checklist : c)),
  );
}

/** 체크리스트를 지워요. */
export async function deleteChecklist(id: string): Promise<NoteChecklist[]> {
  return write(
    KEYS.checklists,
    (await listChecklists()).filter((c) => c.id !== id),
  );
}
