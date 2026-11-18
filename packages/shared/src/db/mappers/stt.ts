// stt_transforms, stt_notes 행(snake_case) ↔ 앱 SttTransform, SttNote(camelCase). (담당: B)
import type { SttMark, SttNote, SttNoteSegment, SttTransform } from '../../types';
import type { Json, Tables, TablesInsert } from '../database.types';

export type SttTransformRow = Tables<'stt_transforms'>;
export type SttTransformInsert = TablesInsert<'stt_transforms'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toSttTransform(row: SttTransformRow): SttTransform {
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    order: row.sort_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toSttTransformInsert(transform: SttTransform): SttTransformInsert {
  return {
    id: transform.id,
    title: transform.title,
    instructions: transform.instructions,
    sort_order: transform.order,
    created_at: transform.createdAt,
    updated_at: transform.updatedAt,
  };
}

// ── stt_notes(받아쓰기 기록) ──

export type SttNoteRow = Tables<'stt_notes'>;
export type SttNoteInsert = TablesInsert<'stt_notes'>;

/** jsonb 배열을 앱 모양으로. 이상한 값은 빼요(앱이 쓴 것만 들어오지만 다른 기기·버전이 쓸 수 있어서). */
function segmentsOf(value: unknown): SttNoteSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const s = v as Partial<SttNoteSegment>;
    if (typeof s.text !== 'string' || typeof s.startMs !== 'number' || typeof s.endMs !== 'number')
      return [];
    const seg: SttNoteSegment = { text: s.text, startMs: s.startMs, endMs: s.endMs };
    if (typeof s.speaker === 'number') seg.speaker = s.speaker;
    return [seg];
  });
}

function marksOf(value: unknown): SttMark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const m = v as Partial<SttMark>;
    if (typeof m.ms !== 'number') return [];
    return [typeof m.text === 'string' ? { ms: m.ms, text: m.text } : { ms: m.ms }];
  });
}

export function toSttNote(row: SttNoteRow): SttNote {
  const note: SttNote = {
    id: row.id,
    title: row.title,
    text: row.text,
    segments: segmentsOf(row.segments),
    marks: marksOf(row.marks),
    durationMs: row.duration_ms,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.recording_id !== null) note.recordingId = row.recording_id;
  if (row.model_id !== null) note.modelId = row.model_id;
  return note;
}

export function toSttNoteInsert(note: SttNote): SttNoteInsert {
  return {
    id: note.id,
    title: note.title,
    text: note.text,
    segments: note.segments as unknown as Json[],
    marks: note.marks as unknown as Json[],
    duration_ms: Math.max(0, Math.round(note.durationMs)),
    recording_id: note.recordingId ?? null,
    model_id: note.modelId ?? null,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}
