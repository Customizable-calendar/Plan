/**
 * 내 세션. 한 양식(템플릿)으로 계속 쌓아 가는 문서 묶음이에요. (담당: A)
 * 예: "업무일지" 세션 안에 날마다 쓴 업무일지 문서가 들어 있어요.
 */
export interface Session {
  id: string;
  /**
   * 이 세션이 쓰는 양식. src/templates/*.json의 id
   * null이면 아직 양식을 고르지 않은 "미완성 세션"이에요. 양식을 고르면 채워져요.
   */
  templateId: string | null;
  title: string;
  /** 가장 최근에 쓴 문서. 아직 문서가 없으면 null */
  lastDocumentId: string | null;
  /** 막 쓰기 메모에서 만든 세션이면 그 메모. 원문은 고치지 않고 그대로 남겨요. */
  source?: SessionSource;
  createdAt: string;
  updatedAt: string;
}

/** 세션을 만든 막 쓰기 메모 (출처) */
export interface SessionSource {
  /** Note.id */
  noteId: string;
  /** 메모 원문 그대로 */
  text: string;
}
