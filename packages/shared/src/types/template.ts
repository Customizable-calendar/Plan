/** 세션 양식. src/templates/*.json 파일 하나가 양식 하나예요. (담당: A) */
export interface TemplateSection {
  key: string;
  title: string;
  /** 사용자와 AI에게 주는 짧은 안내 */
  hint: string;
}

/** 양식 분류. 세션 목록의 칩 필터에 써요. */
export type TemplateCategory = 'work' | 'blog' | 'meeting' | 'research';

/**
 * 양식 아이콘 이름. 앱이 이 이름을 실제 아이콘(SF Symbols, Material)으로 바꿔요.
 * shared는 화면 라이브러리를 모르기 때문에 이름만 정해요.
 */
export type TemplateIcon = 'calendar' | 'pencil' | 'bubble' | 'flask' | 'book';

export interface Template {
  id: string;
  name: string;
  description: string;
  sections: TemplateSection[];
  /** AI 초안을 만들 때 함께 보내는 지침 */
  aiInstructions: string;
  /** 분류. 없으면 '전체'에서만 보여요. */
  category?: TemplateCategory;
  icon?: TemplateIcon;
  /** 대표 태그. 예: ['#업무일지', '#데일리'] */
  tags?: string[];
  /** 새 문서를 열 때 본문에 깔아 두는 마크다운. 없으면 sections 제목으로 만들어요. */
  defaultContent?: string;
}
