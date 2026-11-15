import { describe, expect, it } from 'vitest';

import { type NoteRow, toNote, toNoteInsert } from '../src/db/mappers/notes';
import { fixtures } from '../src';

// 예시 JSON → toNoteInsert → (DB가 채우는 값) → toNote 결과가 원래와 같아야 해요.
function asRow(insert: ReturnType<typeof toNoteInsert>): NoteRow {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    reminder_time_zone: null,
    collaborators: [],
    ...insert,
    reminder_ats: (insert.reminder_ats ?? []).map((at) => at.replace('Z', '+00:00')),
    // DB는 시각을 +00:00 형태로 돌려줘요.
    created_at: insert.created_at!.replace('Z', '+00:00'),
  } as NoteRow;
}

describe('notes mapper', () => {
  it('예시 메모가 DB를 다녀와도 같다', () => {
    for (const note of fixtures.notes) {
      expect(toNote(asRow(toNoteInsert(note)))).toEqual(note);
    }
  });

  it('리마인드와 공동 작업자가 없으면 null과 빈 목록으로 보내고, 받을 때는 칸을 만들지 않는다', () => {
    const insert = toNoteInsert({
      id: 'note-x',
      text: '메모',
      createdAt: '2026-11-15T00:00:00.000Z',
    });
    expect(insert.reminder_ats).toEqual([]);
    expect(insert.reminder_time_zone).toBeNull();
    expect(insert.collaborators).toEqual([]);
    const back = toNote(asRow(insert));
    expect('reminders' in back).toBe(false);
    expect('collaborators' in back).toBe(false);
  });
});
