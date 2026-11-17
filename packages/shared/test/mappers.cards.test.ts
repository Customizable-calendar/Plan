import { describe, expect, it } from 'vitest';

import { type CardRow, toCard, toCardInsert } from '../src/db/mappers/cards';
import { fixtures } from '../src';

// 예시 JSON → toCardInsert → (DB가 채우는 값) → toCard 결과가 원래와 같아야 해요.
function asRow(insert: ReturnType<typeof toCardInsert>): CardRow {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    status: 'suggested',
    start_at: null,
    end_at: null,
    due_at: null,
    person_name: null,
    ...insert,
    // DB는 시각을 +00:00 형태로 돌려줘요.
    created_at: insert.created_at!.replace('Z', '+00:00'),
  } as CardRow;
}

describe('cards mapper', () => {
  it('예시 카드가 DB를 다녀와도 같다', () => {
    for (const card of fixtures.cards) {
      const back = toCard(asRow(toCardInsert(card)));
      expect(JSON.parse(JSON.stringify(back))).toEqual(card);
    }
  });

  it('없는 값은 null로 보내고 undefined로 받는다', () => {
    const card = fixtures.cards.find((c) => c.type === 'idea') ?? fixtures.cards[0];
    const insert = toCardInsert({ ...card, startAt: undefined, dueAt: undefined });
    expect(insert.start_at).toBeNull();
    expect(insert.due_at).toBeNull();
    expect(toCard(asRow(insert)).startAt).toBeUndefined();
  });
});
