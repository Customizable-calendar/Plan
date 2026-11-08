/**
 * 내 세션. 한 양식(템플릿)으로 계속 쌓아 가는 문서 묶음이에요. (담당: A)
 * 예: "업무일지" 세션 안에 날마다 쓴 업무일지 문서가 들어 있어요.
 */
export interface Session {
  id: string;
  /** 이 세션이 쓰는 양식. src/templates/*.json의 id */
  templateId: string;
  title: string;
  /** 가장 최근에 쓴 문서. 아직 문서가 없으면 null */
  lastDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}
