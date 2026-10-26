/** 세션 템플릿으로 만든 문서. 처음엔 본문을 마크다운 문자열로 저장해요. (담당: A) */
export interface Document {
  id: string;
  templateId: string;
  title: string;
  body: string;
  /** 초안을 만들 때 쓴 카드 */
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
}
