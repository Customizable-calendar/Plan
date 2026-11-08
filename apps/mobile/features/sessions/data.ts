import {
  type Document,
  type Session,
  type Template,
  type TemplateCategory,
  fixtures,
  templates,
} from '@noteapp/shared';

import { listEditedDocuments } from '@/features/editor';
import { dataSource, fromFixture } from '@/lib/data-source';

// 세션 화면의 데이터는 여기서만 가져와요. 화면은 이 파일 함수만 불러요.
// M2: dataSource === 'supabase'면 docs_ 테이블 + mapper로 바꿔요. 화면은 그대로예요.

/** 내 세션 목록에 보여줄 한 줄. 세션 + 양식 이름 + 최근 문서 제목을 합쳐요. */
export interface SessionItem extends Session {
  templateName: string;
  lastDocumentTitle: string | null;
}

/** 내 세션. 최근에 고친 세션이 위로 와요. (왼쪽 메뉴가 써요) */
export async function listMySessions(): Promise<SessionItem[]> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');

  const items = fixtures.sessions.map((s) => ({
    ...s,
    templateName: templates.find((t) => t.id === s.templateId)?.name ?? s.title,
    lastDocumentTitle: fixtures.documents.find((d) => d.id === s.lastDocumentId)?.title ?? null,
  }));
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return fromFixture(items);
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

/** 작성한 문서 목록. 최근에 고친 문서가 위로 와요. 이번에 편집기에서 고친 문서도 합쳐요. */
export async function listDocuments(filter: DocumentFilter = {}): Promise<DocumentItem[]> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');

  // 같은 id면 편집기에서 고친 쪽이 이겨요. (Map = 키로 값을 찾는 상자)
  const byId = new Map(fixtures.documents.map((d) => [d.id, d]));
  for (const d of await listEditedDocuments()) byId.set(d.id, d);

  const q = filter.query?.trim().toLowerCase() ?? '';
  const items = [...byId.values()]
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
  return fromFixture(items);
}

/** 홈 최근 문서 위젯. 최근에 고친 문서부터 limit개. */
export async function listRecentDocuments(limit = 3): Promise<Document[]> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');
  const docs = [...fixtures.documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return fromFixture(docs.slice(0, limit));
}
