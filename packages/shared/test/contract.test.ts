import { describe, expect, it } from 'vitest';

import { fixtures, templates } from '../src';

// 타입과 예시 JSON이 서로 맞는지 확인하는 "약속" 검사예요.
describe('예시 데이터', () => {
  it('모든 카드는 실제 메모의 원문 위치를 가리킨다', () => {
    for (const card of fixtures.cards) {
      const note = fixtures.notes.find((n) => n.id === card.source.noteId);
      expect(note, `${card.id}의 메모가 없어요`).toBeDefined();
      const [start, end] = card.source.span;
      expect(note!.text.slice(start, end).length).toBeGreaterThan(0);
    }
  });

  it('사람 카드의 이름은 원문에 그대로 있다', () => {
    for (const card of fixtures.cards.filter((c) => c.type === 'person')) {
      const note = fixtures.notes.find((n) => n.id === card.source.noteId)!;
      expect(note.text).toContain(card.personName);
    }
  });

  it('수행 기록은 할 일 카드를 가리킨다', () => {
    for (const record of fixtures.executions) {
      const card = fixtures.cards.find((c) => c.id === record.cardId);
      expect(card?.type).toBe('task');
    }
  });
});

describe('세션 템플릿', () => {
  it('id가 겹치지 않고 섹션이 하나 이상 있다', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of templates) expect(t.sections.length).toBeGreaterThan(0);
  });
});
