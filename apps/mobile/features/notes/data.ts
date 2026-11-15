import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fixtures,
  type Note,
  type NoteChecklist as ChecklistRecord,
  type NoteChecklistRow,
  type NoteRow,
  toNote,
  toNoteChecklist,
  toNoteChecklistInsert,
  toNoteInsert,
} from '@noteapp/shared';

import { failed, signedIn } from '@/features/cards';
import { createDraftSession } from '@/features/sessions';
import { fromFixture, sourceFor } from '@/lib/data-source';

import { textToChecklist } from './format';

// 메모 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일의 함수만 불러요.
// fixtures: 예시 JSON. 새로 쓴 메모는 앱이 켜져 있는 동안만 기억하고,
//           중요한 메모, 휴지통, 체크리스트는 기기 저장소(AsyncStorage)에 둬요.
// supabase: notes_notes, notes_checklists 테이블(RLS로 본인 것만). 다른 기기에서도 같게 보여요.
//           행은 mapper(@noteapp/shared)로 바꿔요.

const NOTES = 'notes_notes';
const CHECKLISTS = 'notes_checklists';
const remote = sourceFor('notes') === 'supabase';

// ── supabase ──

/** 내 메모 전부. 휴지통에 있거나 다른 곳으로 옮긴 메모도 들어 있어요. */
async function remoteNotes(): Promise<Note[]> {
  const supabase = await signedIn();
  const { data, error } = await supabase.from(NOTES).select('*');
  if (error) failed('메모를 불러오지', error);
  return (data as NoteRow[]).map(toNote);
}

/** 메모 한 줄의 일부 칸만 고쳐요. patch의 이름은 DB 칸 이름(snake_case)이에요. */
async function patchNote(id: string, patch: Partial<NoteRow>, what = '메모를 고치지') {
  const supabase = await signedIn();
  const { error } = await supabase.from(NOTES).update(patch).eq('id', id);
  if (error) failed(what, error);
}

// ── 기기 저장소 (fixtures) ──
// AsyncStorage: 앱을 껐다 켜도 남는 기기 안의 작은 저장 공간이에요 (웹에서는 localStorage).
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
// fixtures에서 새로 쓰거나 고친 메모. 앱이 켜져 있는 동안만 기억해요(앱을 끄면 사라져요).
const added: Note[] = [];
const edited = new Map<string, Note>();

/** 새 메모를 저장할 때 넘기는 값 */
export interface NewNote {
  text: string;
}

// ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
const newestFirst = (a: Note, b: Note) => b.createdAt.localeCompare(a.createdAt);

/** 기록에 있는 메모를 최신순으로 돌려줘요. 휴지통이나 체크리스트, 세션으로 옮긴 메모는 빼요. */
export async function listNotes(): Promise<Note[]> {
  if (remote) {
    return (await remoteNotes()).filter((n) => !n.trashedAt && !n.movedTo).sort(newestFirst);
  }
  const hidden = await read<string[]>(KEYS.hidden, []);
  return [...added, ...(await fromFixture(fixtures.notes))]
    .map((n) => edited.get(n.id) ?? n)
    .filter((n) => !hidden.includes(n.id))
    .sort(newestFirst);
}

/** 메모 원문을 저장해요. 앞뒤 공백만 지우고 내용은 고치지 않아요. */
export async function saveNote({ text }: NewNote): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('빈 메모는 저장하지 않아요.');

  const now = new Date();
  const note: Note = { id: `note-${now.getTime()}`, text: trimmed, createdAt: now.toISOString() };
  if (!remote) {
    added.unshift(note);
    return note;
  }
  const supabase = await signedIn();
  // user_id는 DB가 auth.uid()로 채워요.
  const { error } = await supabase.from(NOTES).insert(toNoteInsert(note));
  if (error) failed('메모를 저장하지', error);
  return note;
}

/** 꾹 눌러 정한 리마인드, 공동 작업자, 해시태그를 저장해요. 원문(text)과 쓴 시각은 고치지 않아요. */
export async function updateNote(note: Note): Promise<Note> {
  if (remote) {
    const { reminder_ats, reminder_time_zone, collaborators, tags } = toNoteInsert(note);
    await patchNote(note.id, { reminder_ats, reminder_time_zone, collaborators, tags });
    return note;
  }
  edited.set(note.id, note);
  // 중요한 메모는 원문을 복사해 둔 것이라 거기도 같이 고쳐요.
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
// 사용자가 기록에서 별을 누른 메모예요.
// supabase: 메모의 important_at 칸에 별을 누른 시각을 적어요.
// fixtures: 원문을 통째로 복사해 기기 저장소에 둬요.

/** 중요한 메모. 최근에 중요 표시한 것이 위로 와요. */
export async function listImportantNotes(): Promise<Note[]> {
  if (!remote) return read<Note[]>(KEYS.important, []);
  return (await remoteNotes())
    .filter((n) => n.importantAt)
    .sort((a, b) => (b.importantAt ?? '').localeCompare(a.importantAt ?? ''));
}

/** 메모를 중요한 메모에 넣어요. 이미 있으면 그대로 둬요. */
export async function markImportant(note: Note): Promise<Note[]> {
  if (remote) {
    await patchNote(note.id, { important_at: new Date().toISOString() });
    return listImportantNotes();
  }
  const list = await listImportantNotes();
  if (list.some((n) => n.id === note.id)) return list;
  return write(KEYS.important, [note, ...list]);
}

/** 중요한 메모에서 빼요. 기록에 있는 원래 메모는 그대로예요. */
export async function unmarkImportant(id: string): Promise<Note[]> {
  if (remote) {
    await patchNote(id, { important_at: null });
    return listImportantNotes();
  }
  return write(
    KEYS.important,
    (await listImportantNotes()).filter((n) => n.id !== id),
  );
}

// ── 휴지통 ──
// 왼쪽으로 넘긴 메모는 바로 지우지 않고 여기에 보관해요. 되돌리거나 완전히 지울 수 있어요.
// supabase: 메모의 trashed_at 칸에 넣은 시각을 적어요. 완전히 지우면 행을 없애요.

export interface TrashedNote {
  note: Note;
  /** 휴지통에 넣은 시각. ISO 8601 (UTC) */
  trashedAt: string;
}

/** 휴지통에 있는 메모. 최근에 넣은 것이 위로 와요. */
export async function listTrash(): Promise<TrashedNote[]> {
  if (!remote) return read<TrashedNote[]>(KEYS.trash, []);
  return (await remoteNotes())
    .flatMap((note) => (note.trashedAt ? [{ note, trashedAt: note.trashedAt }] : []))
    .sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

/** 메모를 기록에서 빼서 휴지통에 넣어요. */
export async function trashNote(note: Note): Promise<void> {
  const trashedAt = new Date().toISOString();
  if (remote) return patchNote(note.id, { trashed_at: trashedAt }, '메모를 휴지통에 넣지');
  await hide(note.id);
  await write(KEYS.trash, [{ note, trashedAt }, ...(await listTrash())]);
}

/** 휴지통에서 꺼내 기록으로 되돌려요. */
export async function restoreNote(id: string): Promise<TrashedNote[]> {
  if (remote) {
    await patchNote(id, { trashed_at: null }, '메모를 되돌리지');
    return listTrash();
  }
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
  if (remote) {
    const supabase = await signedIn();
    // 이 메모에서 만든 체크리스트가 있으면 DB가 같이 지워요.
    const { error } = await supabase.from(NOTES).delete().eq('id', id);
    if (error) failed('메모를 지우지', error);
    return listTrash();
  }
  return write(
    KEYS.trash,
    (await listTrash()).filter((t) => t.note.id !== id),
  );
}

// ── 세션으로 보내기 ──
// 오른쪽으로 넘긴 메모는 기록에서 빠지고, 세션 화면에 양식을 아직 안 고른 "미완성 세션"으로 생겨요.

/** 메모를 미완성 세션으로 보내요. 원문은 고치지 않고 세션의 출처(source)로 그대로 넘겨요. */
export async function moveToSession(note: Note): Promise<void> {
  await createDraftSession({ noteId: note.id, text: note.text });
  if (remote) return patchNote(note.id, { moved_to: 'session' }, '메모를 세션으로 보내지');
  await hide(note.id);
}

// ── 체크리스트 ──
// 꾹 눌러 "체크리스트로 만들기"를 한 메모는 기록에서 빠지고, 막 쓰기 바로 아래에 체크리스트로 보여요.
// supabase: notes_checklists 테이블에 두고, 메모에는 moved_to로 옮긴 표시를 해요.

export interface NoteChecklist extends ChecklistRecord {
  /** 어느 메모에서 왔는지. 원문은 고치지 않고 그대로 남겨요. */
  source: Note;
}

/** 체크리스트. 최근에 만든 것이 위로 와요. */
export async function listChecklists(): Promise<NoteChecklist[]> {
  if (!remote) return read<NoteChecklist[]>(KEYS.checklists, []);
  const supabase = await signedIn();
  const { data, error } = await supabase
    .from(CHECKLISTS)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) failed('체크리스트를 불러오지', error);
  const notes = await remoteNotes();
  return (data as NoteChecklistRow[]).map(toNoteChecklist).flatMap((checklist) => {
    const source = notes.find((n) => n.id === checklist.noteId);
    return source ? [{ ...checklist, source }] : [];
  });
}

/** 메모를 기록에서 빼서 체크리스트로 옮겨요. 줄마다 항목 하나가 돼요. */
export async function moveToChecklist(note: Note): Promise<void> {
  const now = new Date();
  const checklist: NoteChecklist = {
    id: `checklist-${now.getTime()}`,
    noteId: note.id,
    items: textToChecklist(note.text),
    source: note,
    createdAt: now.toISOString(),
  };
  if (remote) {
    const supabase = await signedIn();
    const { error } = await supabase.from(CHECKLISTS).insert(toNoteChecklistInsert(checklist));
    if (error) failed('체크리스트를 만들지', error);
    return patchNote(note.id, { moved_to: 'checklist' }, '메모를 체크리스트로 옮기지');
  }
  await hide(note.id);
  await write(KEYS.checklists, [checklist, ...(await listChecklists())]);
}

/** 항목을 체크하거나 풀어요. */
export async function updateChecklist(checklist: NoteChecklist): Promise<NoteChecklist[]> {
  if (remote) {
    const supabase = await signedIn();
    const { items } = toNoteChecklistInsert(checklist);
    const { error } = await supabase.from(CHECKLISTS).update({ items }).eq('id', checklist.id);
    if (error) failed('체크리스트를 고치지', error);
    return listChecklists();
  }
  return write(
    KEYS.checklists,
    (await listChecklists()).map((c) => (c.id === checklist.id ? checklist : c)),
  );
}

/** 체크리스트를 지워요. 원래 메모의 원문은 남아 있어요. */
export async function deleteChecklist(id: string): Promise<NoteChecklist[]> {
  if (remote) {
    const supabase = await signedIn();
    const { error } = await supabase.from(CHECKLISTS).delete().eq('id', id);
    if (error) failed('체크리스트를 지우지', error);
    return listChecklists();
  }
  return write(
    KEYS.checklists,
    (await listChecklists()).filter((c) => c.id !== id),
  );
}
