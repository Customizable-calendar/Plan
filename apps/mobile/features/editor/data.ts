import {
  type CalendarEvent,
  type Document,
  type Template,
  fixtures,
  templates,
} from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';
import { findDocument, listAllDocuments, putDocument } from '@/lib/documents';

import { monthDay } from './format';

// 편집기 데이터는 여기서만 가져오고 저장해요. 화면은 이 파일 함수만 불러요.
// 문서는 lib/documents.ts(docs_documents)에 저장해요: 기기에 먼저, 로그인하면 계정에도.

export interface EditorData {
  document: Document;
  template: Template | undefined;
}

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
  if (id === 'new') {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return null;
    return { document: newDraft(template, seed), template };
  }

  const document = await findDocument(id);
  if (!document) return null;
  return { document, template: templates.find((t) => t.id === document.templateId) };
}

/** 고친 문서를 저장해요. 앱을 다시 켜도 남아요. */
export async function saveDocument(document: Document): Promise<void> {
  await putDocument(document);
}

/** 저장된 문서 전부(예전 이름 그대로). 세션 목록이 써요. */
export async function listEditedDocuments(): Promise<Document[]> {
  return listAllDocuments();
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
