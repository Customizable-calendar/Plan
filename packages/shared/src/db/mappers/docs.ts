// docs_sessions, docs_documents 행(snake_case) ↔ 앱 Session, Document(camelCase). (테이블: B, 기능: A)
import type { Document, Session } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type SessionRow = Tables<'docs_sessions'>;
export type SessionInsert = TablesInsert<'docs_sessions'>;
export type DocumentRow = Tables<'docs_documents'>;
export type DocumentInsert = TablesInsert<'docs_documents'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toSession(row: SessionRow): Session {
  const session: Session = {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    lastDocumentId: row.last_document_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.source_note_id !== null && row.source_text !== null) {
    session.source = { noteId: row.source_note_id, text: row.source_text };
  }
  return session;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toSessionInsert(session: Session): SessionInsert {
  return {
    id: session.id,
    template_id: session.templateId,
    title: session.title,
    last_document_id: session.lastDocumentId,
    source_note_id: session.source?.noteId ?? null,
    source_text: session.source?.text ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    body: row.body,
    cardIds: row.card_ids,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toDocumentInsert(document: Document): DocumentInsert {
  return {
    id: document.id,
    template_id: document.templateId,
    title: document.title,
    body: document.body,
    card_ids: document.cardIds,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
  };
}
