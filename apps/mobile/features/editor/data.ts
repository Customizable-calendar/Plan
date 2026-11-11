import {
  type CalendarEvent,
  type Document,
  type Template,
  fixtures,
  templates,
} from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

import { monthDay } from './format';

// 편집기 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일 함수만 불러요.
// M2: dataSource === 'supabase'면 docs_ 테이블 + mapper로 바꿔요. 화면은 그대로예요.

export interface EditorData {
  document: Document;
  template: Template | undefined;
}

// M1은 앱이 켜져 있는 동안만 기억해요. (Map = 키로 값을 찾는 상자)
const saved = new Map<string, Document>();

/**
 * 문서를 열어요. id가 'new'면 templateId 양식으로 빈 문서를 새로 만들어요.
 * seed가 있으면 새 문서 본문 맨 위에 그대로 넣어요. (미완성 세션의 메모 원문)
 * 문서를 못 찾으면 null이에요.
 */
export async function openDocument(
  id: string,
  templateId?: string,
  seed?: string,
): Promise<EditorData | null> {
  if (dataSource !== 'fixtures') throw new Error('editor: Supabase 연결은 M2에서 만들어요.');

  if (id === 'new') {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return null;
    return { document: newDraft(template, seed), template };
  }

  const document = saved.get(id) ?? fixtures.documents.find((d) => d.id === id);
  if (!document) return null;
  return fromFixture({ document, template: templates.find((t) => t.id === document.templateId) });
}

/** 고친 문서를 저장해요. */
export async function saveDocument(document: Document): Promise<void> {
  if (dataSource !== 'fixtures') throw new Error('editor: Supabase 연결은 M2에서 만들어요.');
  saved.set(document.id, document);
}

/** 이번에 앱에서 고치거나 새로 쓴 문서. 세션 목록이 예시 문서와 합쳐 보여줘요. */
export async function listEditedDocuments(): Promise<Document[]> {
  if (dataSource !== 'fixtures') return [];
  return fromFixture([...saved.values()]);
}

/** `/캘` 슬래시 명령에서 고를 일정. M2에는 캘린더(C)의 index.ts에서 내보낸 함수로 바꿔요. */
export async function listEventsForSlash(): Promise<CalendarEvent[]> {
  if (dataSource !== 'fixtures') return [];
  return fromFixture([...fixtures.events].sort((a, b) => a.startAt.localeCompare(b.startAt)));
}

/** 양식으로 만든 새 문서 */
function newDraft(template: Template, seed?: string): Document {
  const now = new Date();
  // 양식에 기본 본문이 있으면 그걸, 없으면 칸 제목을 `## 제목`으로 깔아요.
  const base =
    template.defaultContent ?? template.sections.map((s) => `## ${s.title}\n`).join('\n');
  return {
    id: `draft-${now.getTime()}`,
    templateId: template.id,
    title: `${template.name} ${monthDay(now)}`,
    // seed(메모 원문)는 고치지 않고 양식 본문 위에 그대로 넣어요.
    body: seed ? `${seed}\n\n${base}` : base,
    cardIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
