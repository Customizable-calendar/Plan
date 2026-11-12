import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type Document,
  type Session,
  type SessionSource,
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

/** 내 세션. 최근에 고친 세션이 위로 와요. 미완성 세션도 함께예요. (왼쪽 메뉴가 써요) */
export async function listMySessions(): Promise<SessionItem[]> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');

  const complete = fixtures.sessions.filter((s) => s.templateId !== null);
  const items = [...complete, ...(await listDraftSessions())].map((s) => ({
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

// M1에서 지운 문서 id. 앱이 켜져 있는 동안만 기억해요(앱을 다시 켜면 예시 문서는 돌아와요).
const deleted = new Set<string>();

/** 문서를 지워요. 목록과 홈 최근 문서에서 빠져요. */
export async function deleteDocument(id: string): Promise<void> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');
  deleted.add(id);
}

/** 작성한 문서 목록. 최근에 고친 문서가 위로 와요. 이번에 편집기에서 고친 문서도 합쳐요. */
export async function listDocuments(filter: DocumentFilter = {}): Promise<DocumentItem[]> {
  if (dataSource !== 'fixtures') throw new Error('sessions: Supabase 연결은 M2에서 만들어요.');

  // 같은 id면 편집기에서 고친 쪽이 이겨요. (Map = 키로 값을 찾는 상자)
  const byId = new Map(fixtures.documents.map((d) => [d.id, d]));
  for (const d of await listEditedDocuments()) byId.set(d.id, d);

  const q = filter.query?.trim().toLowerCase() ?? '';
  const items = [...byId.values()]
    .filter((d) => !deleted.has(d.id))
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
  const docs = fixtures.documents
    .filter((d) => !deleted.has(d.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return fromFixture(docs.slice(0, limit));
}

// ── 미완성 세션 ──
// 막 쓰기 기록을 오른쪽으로 넘기면 만들어져요. 양식(templateId)을 아직 고르지 않은 세션이에요.
// 기록에서 빠진 메모가 사라지지 않게 기기 저장소(AsyncStorage)에 둬요. (웹에서는 localStorage)
// M2: docs_ 테이블에 templateId가 빈 세션으로 저장해요.
const DRAFTS_KEY = 'sessions.drafts';
// 지운 예시 미완성 세션 id
const REMOVED_KEY = 'sessions.drafts.removed';

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

/** 미완성 세션. 최근에 만든 것이 위로 와요. */
export async function listDraftSessions(): Promise<Session[]> {
  const removed = await read<string[]>(REMOVED_KEY, []);
  const examples = fixtures.sessions.filter((s) => s.templateId === null);
  return [...(await read<Session[]>(DRAFTS_KEY, [])), ...examples]
    .filter((s) => !removed.includes(s.id))
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
  const drafts = await read<Session[]>(DRAFTS_KEY, []);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([session, ...drafts]));
  return session;
}

/** 미완성 세션을 목록에서 지워요. 양식을 골라 문서로 만들었을 때도 써요. */
export async function removeDraftSession(id: string): Promise<void> {
  const drafts = await read<Session[]>(DRAFTS_KEY, []);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.filter((s) => s.id !== id)));
  if (fixtures.sessions.some((s) => s.id === id)) {
    const removed = await read<string[]>(REMOVED_KEY, []);
    await AsyncStorage.setItem(REMOVED_KEY, JSON.stringify([...removed, id]));
  }
}
