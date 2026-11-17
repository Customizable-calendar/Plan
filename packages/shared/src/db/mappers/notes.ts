// notes_notes, notes_checklists 행(snake_case) ↔ 앱 Note, NoteChecklist(camelCase). (담당: A)
import type { Note, NoteChecklist, NoteChecklistItem } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type NoteRow = Tables<'notes_notes'>;
export type NoteInsert = TablesInsert<'notes_notes'>;
export type NoteChecklistRow = Tables<'notes_checklists'>;
export type NoteChecklistInsert = TablesInsert<'notes_checklists'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toNote(row: NoteRow): Note {
  const note: Note = { id: row.id, text: row.text, createdAt: iso(row.created_at) };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  const timeZone = row.reminder_time_zone;
  if (row.reminder_ats.length > 0 && timeZone !== null) {
    note.reminders = row.reminder_ats.map((at) => ({ at: iso(at), timeZone }));
  }
  if (row.collaborators.length > 0) note.collaborators = row.collaborators;
  if (row.tags.length > 0) note.tags = row.tags;
  if (row.important_at !== null) note.importantAt = iso(row.important_at);
  if (row.trashed_at !== null) note.trashedAt = iso(row.trashed_at);
  if (row.moved_to !== null) note.movedTo = row.moved_to;
  return note;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toNoteInsert(note: Note): NoteInsert {
  return {
    id: note.id,
    text: note.text,
    reminder_ats: (note.reminders ?? []).map((r) => r.at),
    // 시간대는 메모 하나에 하나만 저장해요. 리마인드는 한 번에 같은 시간대로 만들어져요.
    reminder_time_zone: note.reminders?.[0]?.timeZone ?? null,
    collaborators: note.collaborators ?? [],
    tags: note.tags ?? [],
    important_at: note.importantAt ?? null,
    trashed_at: note.trashedAt ?? null,
    moved_to: note.movedTo ?? null,
    created_at: note.createdAt,
  };
}

/** DB의 items는 아무 JSON이나 들어갈 수 있는 칸이라, 모양이 맞는 항목만 받아요. */
function toItems(value: unknown): NoteChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { text, checked } = item as Record<string, unknown>;
    return typeof text === 'string' ? [{ text, checked: checked === true }] : [];
  });
}

export function toNoteChecklist(row: NoteChecklistRow): NoteChecklist {
  return {
    id: row.id,
    noteId: row.note_id,
    items: toItems(row.items),
    createdAt: iso(row.created_at),
  };
}

export function toNoteChecklistInsert(checklist: NoteChecklist): NoteChecklistInsert {
  return {
    id: checklist.id,
    note_id: checklist.noteId,
    items: checklist.items.map(({ text, checked }) => ({ text, checked })),
    created_at: checklist.createdAt,
  };
}
