import { describe, expect, it } from 'vitest';

import {
  type DocumentRow,
  type SessionRow,
  toDocument,
  toDocumentInsert,
  toSession,
  toSessionInsert,
} from '../src/db/mappers/docs';
import { type Document, fixtures, type Session } from '../src';

const USER = '00000000-0000-0000-0000-000000000001';

/** insert → (DB가 채우는 값) → row. DB는 시각을 +00:00 형태로 돌려줘요. */
function asRow<T extends { created_at?: string; updated_at?: string }>(insert: T) {
  return {
    user_id: USER,
    ...insert,
    created_at: insert.created_at!.replace('Z', '+00:00'),
    updated_at: insert.updated_at!.replace('Z', '+00:00'),
  };
}

describe('docs_sessions 변환', () => {
  it('예시 세션이 전부 앱 → 행 → 앱 그대로다', () => {
    for (const session of fixtures.sessions) {
      const row = asRow(toSessionInsert(session)) as SessionRow;
      expect(toSession(row)).toEqual(session);
    }
  });

  it('미완성 세션(양식 없음, 메모 출처)도 그대로다', () => {
    const draft: Session = {
      id: 'session-draft-1',
      templateId: null,
      title: '회의 메모',
      lastDocumentId: null,
      source: { noteId: 'note-1', text: '회의 메모\n내일 3시' },
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    };
    const insert = toSessionInsert(draft);
    expect(insert).not.toHaveProperty('user_id');
    expect(insert.source_note_id).toBe('note-1');
    expect(toSession(asRow(insert) as SessionRow)).toEqual(draft);
  });
});

describe('docs_documents 변환', () => {
  it('예시 문서가 전부 앱 → 행 → 앱 그대로다', () => {
    for (const document of fixtures.documents) {
      const row = asRow(toDocumentInsert(document)) as DocumentRow;
      expect(toDocument(row)).toEqual(document);
    }
  });

  it('카드 id 배열을 그대로 둔다', () => {
    const doc: Document = {
      id: 'draft-1',
      templateId: 'work-log',
      title: '업무일지 11/18',
      body: '## 한 일\n',
      cardIds: ['card-1', 'card-2'],
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T01:00:00.000Z',
    };
    expect(toDocument(asRow(toDocumentInsert(doc)) as DocumentRow)).toEqual(doc);
  });
});
