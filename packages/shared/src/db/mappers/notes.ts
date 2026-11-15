// notes_notes 행(snake_case) ↔ 앱 Note(camelCase). (담당: A)
import type { Note } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type NoteRow = Tables<'notes_notes'>;
export type NoteInsert = TablesInsert<'notes_notes'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toNote(row: NoteRow): Note {
  const note: Note = { id: row.id, text: row.text, createdAt: iso(row.created_at) };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.reminder_at !== null && row.reminder_time_zone !== null) {
    note.reminder = { at: iso(row.reminder_at), timeZone: row.reminder_time_zone };
  }
  if (row.collaborators.length > 0) note.collaborators = row.collaborators;
  return note;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toNoteInsert(note: Note): NoteInsert {
  return {
    id: note.id,
    text: note.text,
    reminder_at: note.reminder?.at ?? null,
    reminder_time_zone: note.reminder?.timeZone ?? null,
    collaborators: note.collaborators ?? [],
    created_at: note.createdAt,
  };
}
