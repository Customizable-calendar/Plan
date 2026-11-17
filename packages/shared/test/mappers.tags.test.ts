import { describe, expect, it } from 'vitest';

import {
  assignTagToCategory,
  type TagCategoryRow,
  tagCategoryIndex,
  tagSuggestionKey,
  toDismissedTagSuggestion,
  toDismissedTagSuggestionInsert,
  toTagCategory,
  toTagCategoryInsert,
} from '../src/db/mappers/tags';
import type { TagCategory } from '../src';

const USER = '00000000-0000-0000-0000-000000000001';
const T = '2026-11-17T00:00:00.000Z';

// TagCategory → toTagCategoryInsert → (DB가 채우는 값) → toTagCategory 결과가 원래와 같아야 해요.
function asRow(insert: ReturnType<typeof toTagCategoryInsert>): TagCategoryRow {
  return {
    user_id: USER,
    ...insert,
    // DB는 시각을 +00:00 형태로 돌려줘요.
    created_at: insert.created_at!.replace('Z', '+00:00'),
    updated_at: insert.updated_at!.replace('Z', '+00:00'),
  } as TagCategoryRow;
}

const dev: TagCategory = {
  id: 'tag-category-1',
  name: '개발',
  color: 'primary',
  tags: ['#개발', '#React_Native'],
  order: 0,
  createdAt: T,
  updatedAt: T,
};
const health: TagCategory = {
  ...dev,
  id: 'tag-category-2',
  name: '운동',
  tags: ['#러닝'],
  order: 1,
};

describe('tags mapper', () => {
  it('카테고리가 DB를 다녀와도 같다', () => {
    expect(toTagCategory(asRow(toTagCategoryInsert(dev)))).toEqual(dev);
  });

  it('색이 없으면 null로 보내고, 받을 때는 칸을 만들지 않는다', () => {
    const { color: _none, ...plain } = dev;
    const insert = toTagCategoryInsert(plain);
    expect(insert.color).toBeNull();
    expect('color' in toTagCategory(asRow(insert))).toBe(false);
  });
});

describe('assignTagToCategory', () => {
  const now = '2026-11-17T01:00:00.000Z';

  it('다른 카테고리에 있던 해시태그는 옮겨 오고, 바뀐 것만 돌려준다', () => {
    const changed = assignTagToCategory([dev, health], '#개발', health.id, now);
    expect(changed.map((c) => [c.id, c.tags, c.updatedAt])).toEqual([
      [dev.id, ['#React_Native'], now],
      [health.id, ['#러닝', '#개발'], now],
    ]);
  });

  it('이미 그 카테고리에 있으면 아무것도 안 바꾼다', () => {
    expect(assignTagToCategory([dev, health], '#개발', dev.id, now)).toEqual([]);
  });

  it('null이면 어느 카테고리에서도 뺀다', () => {
    const changed = assignTagToCategory([dev, health], '#러닝', null, now);
    expect(changed).toEqual([{ ...health, tags: [], updatedAt: now }]);
  });
});

describe('tagCategoryIndex', () => {
  it('해시태그마다 카테고리 id를 찾는다', () => {
    const index = tagCategoryIndex([health, dev]);
    expect(index.get('#개발')).toBe(dev.id);
    expect(index.get('#러닝')).toBe(health.id);
    expect(index.get('#없음')).toBeUndefined();
  });
});

describe('tagSuggestionKey', () => {
  it('넣기 추천은 해시태그와 카테고리로 정해진다', () => {
    expect(tagSuggestionKey({ kind: 'assign', tag: '#Expo', categoryId: dev.id })).toBe(
      `assign:#Expo:${dev.id}`,
    );
  });

  it('묶기 추천은 해시태그 순서·중복과 상관없이 같은 키다', () => {
    const a = tagSuggestionKey({ kind: 'group', tags: ['#헬스', '#러닝'] });
    const b = tagSuggestionKey({ kind: 'group', tags: ['#러닝', '#헬스', '#러닝'], name: '운동' });
    expect(a).toBe('group:#러닝,#헬스');
    expect(b).toBe(a);
  });

  it('거절 기록이 DB를 다녀와도 같다', () => {
    const dismissed = { id: 'group:#러닝,#헬스', createdAt: T };
    const insert = toDismissedTagSuggestionInsert(dismissed);
    const row = { user_id: USER, ...insert, created_at: insert.created_at!.replace('Z', '+00:00') };
    expect(toDismissedTagSuggestion(row as never)).toEqual(dismissed);
  });
});
