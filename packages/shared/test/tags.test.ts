import { describe, expect, it } from 'vitest';

import { cleanTagSuggestions, type TagCategory, type TagSuggestion } from '../src';

const T = '2026-11-17T00:00:00.000Z';
const dev: TagCategory = {
  id: 'c-dev',
  name: '개발',
  tags: ['#개발'],
  order: 0,
  createdAt: T,
  updatedAt: T,
};
const known = ['#개발', '#Expo', '#러닝', '#헬스', '#요가', '#독서'];

describe('cleanTagSuggestions', () => {
  it('맞는 추천은 그대로 둔다', () => {
    const s: TagSuggestion[] = [
      { kind: 'assign', tag: '#Expo', categoryId: 'c-dev' },
      { kind: 'group', tags: ['#러닝', '#헬스'], name: ' 운동 ' },
    ];
    expect(cleanTagSuggestions(s, [dev], known)).toEqual([
      { kind: 'assign', tag: '#Expo', categoryId: 'c-dev' },
      { kind: 'group', tags: ['#러닝', '#헬스'], name: '운동' },
    ]);
  });

  it('없는 카테고리, 안 쓰는 해시태그, 이미 묶인 해시태그는 뺀다', () => {
    const s: TagSuggestion[] = [
      { kind: 'assign', tag: '#Expo', categoryId: 'c-없음' },
      { kind: 'assign', tag: '#지어낸태그', categoryId: 'c-dev' },
      { kind: 'assign', tag: '#개발', categoryId: 'c-dev' },
    ];
    expect(cleanTagSuggestions(s, [dev], known)).toEqual([]);
  });

  it('해시태그 하나는 추천 하나에만, 남은 게 1개뿐인 묶음은 뺀다', () => {
    const s: TagSuggestion[] = [
      { kind: 'group', tags: ['#러닝', '#헬스'] },
      { kind: 'group', tags: ['#헬스', '#요가'] },
      { kind: 'group', tags: ['#독서', '#독서'] },
    ];
    expect(cleanTagSuggestions(s, [dev], known)).toEqual([
      { kind: 'group', tags: ['#러닝', '#헬스'] },
    ]);
  });
});
