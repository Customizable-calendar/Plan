import { describe, expect, it } from 'vitest';

import { type FileRow, toFileInsert, toFileMeta } from '../src/db/mappers/files';
import type { FileMeta } from '../src';

const USER = '00000000-0000-0000-0000-000000000001';

// FileMeta → toFileInsert → (DB가 채우는 값) → toFileMeta 결과가 원래와 같아야 해요.
function asRow(insert: ReturnType<typeof toFileInsert>): FileRow {
  return {
    user_id: USER,
    thumbnail_key: null,
    ...insert,
    // DB는 시각을 +00:00 형태로 돌려줘요.
    created_at: insert.created_at!.replace('Z', '+00:00'),
  } as FileRow;
}

describe('files mapper', () => {
  const photo: FileMeta = {
    id: '11111111-1111-1111-1111-111111111111',
    key: `${USER}/photo.webp`,
    thumbnailKey: `${USER}/photo_thumb.webp`,
    mime: 'image/webp',
    size: 120345,
    status: 'ready',
    createdAt: '2026-11-16T00:00:00.000Z',
  };

  it('사진 정보가 DB를 다녀와도 같다', () => {
    expect(toFileMeta(asRow(toFileInsert(photo)))).toEqual(photo);
  });

  it('썸네일이 없으면 null로 보내고, 받을 때는 칸을 만들지 않는다', () => {
    const { thumbnailKey: _none, ...plain } = photo;
    const insert = toFileInsert(plain);
    expect(insert.thumbnail_key).toBeNull();
    expect('thumbnailKey' in toFileMeta(asRow(insert))).toBe(false);
  });
});
