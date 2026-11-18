import { describe, expect, it } from 'vitest';

import { type SttTransformRow, toSttTransform, toSttTransformInsert } from '../src/db/mappers/stt';
import type { SttTransform } from '../src';

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
