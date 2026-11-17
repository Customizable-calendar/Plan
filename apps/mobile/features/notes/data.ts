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

import { createDraftSession } from '@/features/sessions';
import { localFirstTable } from '@/lib/local-first';

import { textToChecklist } from './format';

// 메모 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일의 함수만 불러요.
// 로그인 전: 이 기기에만 저장해요. 로그인 후: 기기와 계정(notes_notes, notes_checklists) 둘 다에 저장해요.
// 해시태그(tags), 중요 표시, 휴지통, 옮긴 곳도 메모 한 줄에 같이 들어가서 계정에 같이 올라가요.
// 저장 방식은 lib/local-first.ts, 행 변환은 mapper(@noteapp/shared)예요.

const notes = localFirstTable<Note>({
  feature: 'notes',
  table: 'notes_notes',
  toRow: toNoteInsert,
  fromRow: (row) => toNote(row as NoteRow),
  seed: () => fixtures.notes,
});

const checklists = localFirstTable<ChecklistRecord>({
  feature: 'notes',
  table: 'notes_checklists',
  toRow: toNoteChecklistInsert,
  fromRow: (row) => toNoteChecklist(row as NoteChecklistRow),
  // 체크리스트는 메모를 가리켜서(외래 키) 메모를 먼저 올려요.
  after: () => notes.sync(),
});

async function findNote(id: string): Promise<Note | undefined> {
  return (await notes.list()).find((n) => n.id === id);
}

async function patch(id: string, change: Partial<Note>) {
  const note = await findNote(id);
  if (note) await notes.put([{ ...note, ...change }]);
}

// ── 기록 ──

/** 새 메모를 저장할 때 넘기는 값 */
export interface NewNote {
  text: string;
}

// ISO 8601 문자열은 글자 순서가 곧 시간 순서라서 문자열 비교로 정렬할 수 있어요.
const newestFirst = (a: Note, b: Note) => b.createdAt.localeCompare(a.createdAt);

/** 기록에 있는 메모를 최신순으로 돌려줘요. 휴지통이나 체크리스트, 세션으로 옮긴 메모는 빼요. */
export async function listNotes(): Promise<Note[]> {
  return (await notes.list()).filter((n) => !n.trashedAt && !n.movedTo).sort(newestFirst);
}

/** 메모 원문을 저장해요. 앞뒤 공백만 지우고 내용은 고치지 않아요. */
export async function saveNote({ text }: NewNote): Promise<Note> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('빈 메모는 저장하지 않아요.');
  const now = new Date();
  const note: Note = { id: `note-${now.getTime()}`, text: trimmed, createdAt: now.toISOString() };
  await notes.put([note]);
  return note;
}

/** 꾹 눌러 정한 리마인드, 공동 작업자, 해시태그를 저장해요. 원문(text)과 쓴 시각은 고치지 않아요. */
export async function updateNote(note: Note): Promise<Note> {
  const saved = await findNote(note.id);
  const next: Note = saved
    ? {
        ...saved,
        reminders: note.reminders,
        collaborators: note.collaborators,
        tags: note.tags,
      }
    : note;
  await notes.put([next]);
  return next;
}

// ── 중요한 메모 ──
// 사용자가 기록에서 별을 누른 메모예요. 메모의 importantAt에 별을 누른 시각을 적어요.

/** 중요한 메모. 최근에 중요 표시한 것이 위로 와요. */
export async function listImportantNotes(): Promise<Note[]> {
  return (await notes.list())
    .filter((n) => n.importantAt && !n.trashedAt)
    .sort((a, b) => (b.importantAt ?? '').localeCompare(a.importantAt ?? ''));
}

/** 메모를 중요한 메모에 넣어요. 이미 있으면 그대로 둬요. */
export async function markImportant(note: Note): Promise<Note[]> {
  const saved = (await findNote(note.id)) ?? note;
  if (!saved.importantAt) await notes.put([{ ...saved, importantAt: new Date().toISOString() }]);
  return listImportantNotes();
}

/** 중요한 메모에서 빼요. 기록에 있는 원래 메모는 그대로예요. */
export async function unmarkImportant(id: string): Promise<Note[]> {
  await patch(id, { importantAt: undefined });
  return listImportantNotes();
}

// ── 휴지통 ──
// 왼쪽으로 넘긴 메모는 바로 지우지 않고 여기에 보관해요. 되돌리거나 완전히 지울 수 있어요.
// 메모의 trashedAt에 넣은 시각을 적어요. 완전히 지우면 메모가 없어져요.

export interface TrashedNote {
  note: Note;
  /** 휴지통에 넣은 시각. ISO 8601 (UTC) */
  trashedAt: string;
}

/** 휴지통에 있는 메모. 최근에 넣은 것이 위로 와요. */
export async function listTrash(): Promise<TrashedNote[]> {
  return (await notes.list())
    .flatMap((note) => (note.trashedAt ? [{ note, trashedAt: note.trashedAt }] : []))
    .sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

/** 메모를 기록에서 빼서 휴지통에 넣어요. */
export async function trashNote(note: Note): Promise<void> {
  const saved = (await findNote(note.id)) ?? note;
  await notes.put([{ ...saved, trashedAt: new Date().toISOString() }]);
}

/** 휴지통에서 꺼내 기록으로 되돌려요. */
export async function restoreNote(id: string): Promise<TrashedNote[]> {
  await patch(id, { trashedAt: undefined });
  return listTrash();
}

/** 휴지통에서 완전히 지워요. 되돌릴 수 없어요. 이 메모에서 만든 체크리스트도 같이 지워요. */
export async function deleteForever(id: string): Promise<TrashedNote[]> {
  const linked = (await checklists.list()).filter((c) => c.noteId === id).map((c) => c.id);
  await checklists.remove(linked);
  await notes.remove([id]);
  return listTrash();
}

// ── 세션으로 보내기 ──
// 오른쪽으로 넘긴 메모는 기록에서 빠지고, 세션 화면에 양식을 아직 안 고른 "미완성 세션"으로 생겨요.

/** 메모를 미완성 세션으로 보내요. 원문은 고치지 않고 세션의 출처(source)로 그대로 넘겨요. */
export async function moveToSession(note: Note): Promise<void> {
  await createDraftSession({ noteId: note.id, text: note.text });
  await patch(note.id, { movedTo: 'session' });
}

// ── 체크리스트 ──
// 꾹 눌러 "체크리스트로 만들기"를 한 메모는 기록에서 빠지고, 막 쓰기 바로 아래에 체크리스트로 보여요.
// 체크리스트는 따로 두고, 메모에는 movedTo로 옮긴 표시를 해요.

export interface NoteChecklist extends ChecklistRecord {
  /** 어느 메모에서 왔는지. 원문은 고치지 않고 그대로 남겨요. */
  source: Note;
}

/** 체크리스트. 최근에 만든 것이 위로 와요. */
export async function listChecklists(): Promise<NoteChecklist[]> {
  const [list, all] = await Promise.all([checklists.list(), notes.list()]);
  return list
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((checklist) => {
      const source = all.find((n) => n.id === checklist.noteId);
      return source ? [{ ...checklist, source }] : [];
    });
}

/** 메모를 기록에서 빼서 체크리스트로 옮겨요. 줄마다 항목 하나가 돼요. */
export async function moveToChecklist(note: Note): Promise<void> {
  const now = new Date();
  const saved = (await findNote(note.id)) ?? note;
  // 메모를 먼저 저장해야 계정에서 체크리스트가 메모를 가리킬 수 있어요.
  await notes.put([{ ...saved, movedTo: 'checklist' }]);
  await checklists.put([
    {
      id: `checklist-${now.getTime()}`,
      noteId: note.id,
      items: textToChecklist(note.text),
      createdAt: now.toISOString(),
    },
  ]);
}

/** 항목을 체크하거나 풀어요. */
export async function updateChecklist(checklist: NoteChecklist): Promise<NoteChecklist[]> {
  const { source: _source, ...record } = checklist;
  await checklists.put([record]);
  return listChecklists();
}

/** 체크리스트를 지워요. 원래 메모의 원문은 남아 있어요. */
export async function deleteChecklist(id: string): Promise<NoteChecklist[]> {
  await checklists.remove([id]);
  return listChecklists();
}
