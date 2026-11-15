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
  const timeZone = row.reminder_time_zone;
  if (row.reminder_ats.length > 0 && timeZone !== null) {
    note.reminders = row.reminder_ats.map((at) => ({ at: iso(at), timeZone }));
  }
  if (row.collaborators.length > 0) note.collaborators = row.collaborators;
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
    created_at: note.createdAt,
  };
}
