import { fixtures } from '@noteapp/shared';
import { describe, expect, it } from 'vitest';

import cases from '../cases/cases.json';
import { extractCards } from '../src';
import { cardHints, splitPieces, taskTitle } from '../src/extract';

const timezone = 'Asia/Seoul';
const options = { now: new Date('2026-10-26T01:00:00.000Z'), timezone };

interface Expected {
  type: string;
  title?: string;
  personName?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
}

const same = (a?: string, b?: string) =>
  a === undefined || (b !== undefined && new Date(a).getTime() === new Date(b).getTime());

describe('extractCards', () => {
  it('빈 메모에서는 카드를 만들지 않는다', async () => {
    const cards = await extractCards({ id: 'n', text: '   ', createdAt: '' }, options);
    expect(cards).toEqual([]);
  });

  it('예시 메모에서 fixtures와 같은 span을 만든다', async () => {
    for (const note of fixtures.notes) {
      const cards = await extractCards(note, options);
      const spans = (type: string) =>
        cards.filter((c) => c.type === type).map((c) => c.source.span);
      for (const f of fixtures.cards.filter((c) => c.source.noteId === note.id)) {
        expect(spans(f.type)).toContainEqual(f.source.span);
      }
    }
  });

  it('모든 카드는 suggested이고 span이 원문 안에 있다', async () => {
    for (const c of cases) {
      const note = { id: c.id, text: c.text, createdAt: c.now };
      for (const card of await extractCards(note, { now: new Date(c.now), timezone })) {
        expect(card.status).toBe('suggested');
        const [s, e] = card.source.span;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(c.text.length);
        expect(e).toBeGreaterThan(s);
      }
    }
  });

  it('기기 시간대와 상관없이 메모 시간대로 계산한다', async () => {
    const note = { id: 'tz', text: '내일 오전 9시 병원', createdAt: '' };
    const seoul = await extractCards(note, options);
    expect(seoul[0].startAt).toBe('2026-10-27T00:00:00.000Z');
    // 같은 순간이 뉴욕에서는 10/25 21:00 → "내일 오전 9시" = 10/26 09:00 EDT
    const ny = await extractCards(note, { ...options, timezone: 'America/New_York' });
    expect(ny[0].startAt).toBe('2026-10-26T13:00:00.000Z');
  });
});

describe('cases/cases.json', () => {
  for (const c of cases as { id: string; now: string; text: string; expected: Expected[] }[]) {
    it(`${c.id}: ${c.text.replace(/\n/g, ' / ')}`, async () => {
      const cards = await extractCards(
        { id: c.id, text: c.text, createdAt: c.now },
        { now: new Date(c.now), timezone },
      );
      const got = cards.map(({ type, title, personName, startAt, endAt, dueAt }) => ({
        type,
        title,
        personName,
        startAt,
        endAt,
        dueAt,
      }));
      const shown = JSON.stringify(got, null, 1);
      for (const want of c.expected) {
        const hit = got.find(
          (g) =>
            g.type === want.type &&
            (want.title === undefined || g.title === want.title) &&
            (want.personName === undefined || g.personName === want.personName) &&
            same(want.startAt, g.startAt) &&
            same(want.endAt, g.endAt) &&
            same(want.dueAt, g.dueAt),
        );
        expect(hit, `못 찾음 ${JSON.stringify(want)}\n받은 카드: ${shown}`).toBeTruthy();
      }
      expect(got.length, `받은 카드: ${shown}`).toBe(c.expected.length);
    });
  }
});

describe('splitPieces', () => {
  it('문장·줄·목록 기호로 자르고 원문 위치를 지킨다', () => {
    const text = '내일 회의. 견적서 보내기\n- 우유 사기\n2.5시간 걸림';
    const pieces = splitPieces(text);
    expect(pieces.map((p) => p.text)).toEqual([
      '내일 회의',
      '견적서 보내기',
      '우유 사기',
      '2.5시간 걸림',
    ]);
    for (const p of pieces) expect(text.slice(p.start, p.start + p.text.length)).toBe(p.text);
  });
});

describe('taskTitle', () => {
  it.each([
    ['견적서 보내야 함', '견적서 보내기'],
    ['그 전에 견적서 보내야 함', '견적서 보내기'],
    ['과제 제출해야 돼', '과제 제출하기'],
    ['약 먹어야지', '약 먹기'],
    ['우유 사기', '우유 사기'],
  ])('%s → %s', (input, want) => expect(taskTitle(input)).toBe(want));
});

describe('cardHints', () => {
  const at = '2026-10-26T01:00:00.000Z'; // 10/26 (월) 10:00 KST
  const hints = async (text: string) => {
    const [card] = await extractCards(
      { id: 'h', text, createdAt: at },
      { now: new Date(at), timezone },
    );
    return cardHints(card, text, timezone);
  };

  it('오전·오후가 없으면 짐작한 쪽을 알려 준다', async () => {
    expect(await hints('내일 3시 회의')).toEqual(['오전·오후가 없어서 오후로 봤어요']);
    expect(await hints('내일 9시 회의')).toEqual(['오전·오후가 없어서 오전으로 봤어요']);
  });

  it('다 적혀 있으면 아무것도 없다', async () => {
    expect(await hints('내일 오후 3시 회의')).toEqual([]);
    expect(await hints('내일 15:00 회의')).toEqual([]);
  });

  it('날짜가 없으면 오늘·내일 중 어느 쪽으로 봤는지 알려 준다', async () => {
    expect(await hints('오후 5시 회의')).toEqual(['날짜가 없어서 오늘로 봤어요']);
    expect(await hints('오전 8시 회의')).toEqual(['날짜가 없어서 내일로 봤어요']);
  });

  it('지난 날짜는 내년으로 봤다고 알려 준다', async () => {
    expect(await hints('3월 2일 개강')).toEqual(['지난 날짜라 내년으로 봤어요']);
  });

  it('fixtures 카드에도 쓸 수 있다', () => {
    const note = fixtures.notes[0];
    const card = fixtures.cards.find((c) => c.id === 'card-1')!;
    expect(cardHints(card, note.text, timezone)).toEqual(['오전·오후가 없어서 오후로 봤어요']);
  });
});
