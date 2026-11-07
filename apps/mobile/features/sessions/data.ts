import { type Session, type Template, fixtures, templates } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

// 세션 화면의 데이터는 여기서만 가져와요. 화면은 이 파일 함수만 불러요.
// M2: dataSource === 'supabase'면 docs_ 테이블 + mapper로 바꿔요. 화면은 그대로예요.

/** 내 세션 목록에 보여줄 한 줄. 세션 + 양식 이름 + 최근 문서 제목을 합쳐요. */
export interface SessionItem extends Session {
  templateName: string;
  lastDocumentTitle: string | null;
}

/** 내 세션. 최근에 고친 세션이 위로 와요. */
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
