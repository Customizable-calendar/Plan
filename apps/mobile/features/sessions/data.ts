import {
  type Document,
  type Session,
  type SessionSource,
  type Template,
  type TemplateCategory,
  templates,
} from '@noteapp/shared';

import { fromFixture } from '@/lib/data-source';
import {
  listAllDocuments,
  listSessions,
  putSession,
  removeDocument,
  removeSession,
} from '@/lib/documents';

// 세션 화면의 데이터는 여기서만 가져와요. 화면은 이 파일 함수만 불러요.
// 세션·문서는 lib/documents.ts(docs_sessions, docs_documents)에 저장해요: 기기에 먼저, 로그인하면 계정에도.

/** 내 세션 목록에 보여줄 한 줄. 세션 + 양식 이름 + 최근 문서 제목을 합쳐요. */
export interface SessionItem extends Session {
  templateName: string;
  lastDocumentTitle: string | null;
}

/** 내 세션. 최근에 고친 세션이 위로 와요. 미완성 세션도 함께예요. (왼쪽 메뉴가 써요) */
export async function listMySessions(): Promise<SessionItem[]> {
  const [all, docs] = await Promise.all([listSessions(), listAllDocuments()]);
  const items = all.map((s) => ({
    ...s,
    templateName: templates.find((t) => t.id === s.templateId)?.name ?? s.title,
    lastDocumentTitle: docs.find((d) => d.id === s.lastDocumentId)?.title ?? null,
  }));
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

/** 새 세션을 시작할 때 고르는 양식. 양식은 코드가 아니라 packages/shared/src/templates/*.json이에요. */
export async function listTemplates(): Promise<Template[]> {
  // 양식은 앱에 들어 있는 JSON이라 M2에도 그대로 써요.
  return fromFixture(templates);
}

/** 세션 목록 카드 한 장: 문서 + 그 문서의 양식 */
export interface DocumentItem {
  document: Document;
  template: Template | undefined;
}

export interface DocumentFilter {
  /** 없으면 전체 */
  category?: TemplateCategory;
  /** 제목, 본문, 태그에서 찾아요. 대소문자는 가리지 않아요. */
  query?: string;
}

/** 문서를 지워요. 목록과 홈 최근 문서에서 빠져요(로그인했으면 계정에서도). */
export async function deleteDocument(id: string): Promise<void> {
  await removeDocument(id);
}

/** 작성한 문서 목록. 최근에 고친 문서가 위로 와요. 이번에 편집기에서 고친 문서도 합쳐요. */
export async function listDocuments(filter: DocumentFilter = {}): Promise<DocumentItem[]> {
  const q = filter.query?.trim().toLowerCase() ?? '';
  const items = (await listAllDocuments())
    .map((document) => ({
      document,
      template: templates.find((t) => t.id === document.templateId),
    }))
    .filter(({ template }) => !filter.category || template?.category === filter.category)
    .filter(({ document, template }) => {
      if (!q) return true;
      const haystack = [document.title, document.body, ...(template?.tags ?? [])].join('\n');
      return haystack.toLowerCase().includes(q);
    });

  items.sort((a, b) => b.document.updatedAt.localeCompare(a.document.updatedAt));
  return items;
}

/** 홈 최근 문서 위젯. 최근에 고친 문서부터 limit개. */
export async function listRecentDocuments(limit = 3): Promise<Document[]> {
  return (await listAllDocuments()).slice(0, limit);
}

// ── 미완성 세션 ──
// 막 쓰기 기록을 오른쪽으로 넘기면 만들어져요. 양식(templateId)을 아직 고르지 않은 세션이에요.
// docs_sessions에 template_id가 빈 세션으로 저장해요(예전 AsyncStorage 'sessions.drafts'는 처음 한 번 옮겨요).

/** 미완성 세션. 최근에 만든 것이 위로 와요. */
export async function listDraftSessions(): Promise<Session[]> {
  return (await listSessions())
    .filter((s) => s.templateId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 막 쓰기 메모로 미완성 세션을 만들어요. 제목은 메모 첫 줄, 원문은 source에 그대로 남겨요. */
export async function createDraftSession(source: SessionSource): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: `session-draft-${Date.now()}`,
    templateId: null,
    title: source.text.split('\n')[0].trim().slice(0, 40) || '미완성 세션',
    lastDocumentId: null,
    source,
    createdAt: now,
    updatedAt: now,
  };
  await putSession(session);
  return session;
}

/** 미완성 세션을 목록에서 지워요. 양식을 골라 문서로 만들었을 때도 써요. */
export async function removeDraftSession(id: string): Promise<void> {
  await removeSession(id);
}
