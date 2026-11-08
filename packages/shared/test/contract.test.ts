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

  it('기본 양식 4개는 분류와 태그가 있고, 분류가 겹치지 않는다', () => {
    const categorized = templates.filter((t) => t.category);
    expect(categorized.map((t) => t.category).sort()).toEqual([
      'blog',
      'meeting',
      'research',
      'work',
    ]);
    for (const t of categorized) {
      expect(t.tags?.length).toBeGreaterThan(0);
      for (const tag of t.tags ?? []) expect(tag.startsWith('#')).toBe(true);
    }
  });

  it('모든 예시 문서는 있는 양식을 쓴다', () => {
    for (const doc of fixtures.documents) {
      expect(
        templates.some((t) => t.id === doc.templateId),
        doc.id,
      ).toBe(true);
    }
  });
});
