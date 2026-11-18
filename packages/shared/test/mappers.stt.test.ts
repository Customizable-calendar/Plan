import { describe, expect, it } from 'vitest';

import {
  type SttNoteRow,
  type SttTransformRow,
  toSttNote,
  toSttNoteInsert,
  toSttTransform,
  toSttTransformInsert,
} from '../src/db/mappers/stt';
import type { SttNote, SttTransform } from '../src';

const USER = '00000000-0000-0000-0000-000000000001';
const T = '2026-11-18T00:00:00.000Z';

const minutes: SttTransform = {
  id: 'stt-transform-1',
  title: '회의록으로 정리',
  instructions: '받아쓴 회의를 안건, 결정, 할 일로 나눠 정리해 줘.',
  order: 0,
  createdAt: T,
  updatedAt: T,
};

describe('stt_transforms 변환', () => {
  it('앱 → 행 → 앱이 그대로다', () => {
    const insert = toSttTransformInsert(minutes);
    expect(insert).not.toHaveProperty('user_id');
    const row = {
      user_id: USER,
      ...insert,
      // DB는 시각을 +00:00 형태로 돌려줘요.
      created_at: insert.created_at!.replace('Z', '+00:00'),
      updated_at: insert.updated_at!.replace('Z', '+00:00'),
    } as SttTransformRow;
    expect(toSttTransform(row)).toEqual(minutes);
  });
});

describe('stt_notes 변환', () => {
  const note: SttNote = {
    id: 'stt-note-1',
    title: '받아쓰기 11/18 09:30',
    text: '회의 시작할게요.\n네 좋아요.',
    segments: [
      { text: '회의 시작할게요', startMs: 0, endMs: 2000, speaker: 0 },
      { text: '네 좋아요', startMs: 2200, endMs: 3000, speaker: 1 },
    ],
    marks: [{ ms: 1500 }, { ms: 2500, text: '견적서 확인' }],
    durationMs: 3200,
    recordingId: '1763425800000',
    modelId: 'small',
    createdAt: T,
    updatedAt: T,
  };

  it('앱 → 행 → 앱이 그대로다', () => {
    const insert = toSttNoteInsert(note);
    expect(insert).not.toHaveProperty('user_id');
    const row = {
      user_id: USER,
      ...insert,
      created_at: insert.created_at!.replace('Z', '+00:00'),
      updated_at: insert.updated_at!.replace('Z', '+00:00'),
    } as SttNoteRow;
    expect(toSttNote(row)).toEqual(note);
  });

  it('원본·모델이 없으면 칸을 안 만들고, 이상한 jsonb 값은 뺀다', () => {
    const row = {
      user_id: USER,
      id: 'stt-note-2',
      title: '빈 기록',
      text: '',
      segments: [{ text: '좋아요', startMs: 0, endMs: 500 }, { text: 3 }, 'x'],
      marks: [{ ms: 10 }, { text: '시각 없음' }],
      duration_ms: 500,
      recording_id: null,
      model_id: null,
      created_at: '2026-11-18T00:00:00+00:00',
      updated_at: '2026-11-18T00:00:00+00:00',
    } as unknown as SttNoteRow;
    const back = toSttNote(row);
    expect(back.segments).toEqual([{ text: '좋아요', startMs: 0, endMs: 500 }]);
    expect(back.marks).toEqual([{ ms: 10 }]);
    expect(back).not.toHaveProperty('recordingId');
    expect(back).not.toHaveProperty('modelId');
  });
});
