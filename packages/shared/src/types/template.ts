/** 세션 양식. src/templates/*.json 파일 하나가 양식 하나예요. (담당: A) */
export interface TemplateSection {
  key: string;
  title: string;
  /** 사용자와 AI에게 주는 짧은 안내 */
  hint: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sections: TemplateSection[];
  /** AI 초안을 만들 때 함께 보내는 지침 */
  aiInstructions: string;
}
