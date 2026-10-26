import { describe, expect, it } from 'vitest';

import { extractCards } from '../src';

const options = { now: new Date('2026-10-26T01:00:00.000Z'), timezone: 'Asia/Seoul' };

describe('extractCards', () => {
  it('빈 메모에서는 카드를 만들지 않는다', async () => {
    const cards = await extractCards({ id: 'n', text: '   ', createdAt: '' }, options);
    expect(cards).toEqual([]);
  });

  // M2에서 cases/cases.json을 하나씩 통과시키며 todo를 지워요.
  it.todo('case-1: 일정·할 일·사람 카드를 찾는다');
  it.todo('case-2: "모레 오전 10시"를 날짜로 바꾼다');
  it.todo('case-3: "다음 주 화요일까지"를 마감으로 바꾼다');
});
