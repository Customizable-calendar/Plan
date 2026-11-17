/**
 * 해시태그 카테고리. 같은 카테고리로 지정한 해시태그를 묶어 둬요.
 * 메모(Note.tags)와 일정 제목의 해시태그를 같이 묶어요. 해시태그 하나는 카테고리 하나에만 들어가요.
 * (테이블: B, 화면: C)
 */
export interface TagCategory {
  id: string;
  /** 1~30자 */
  name: string;
  /** 디자인 시스템 색 이름이나 #RRGGBB. 없으면 앱이 정해요. */
  color?: string;
  /** '#'로 시작하고 공백이 없는 해시태그. 예: ['#개발', '#React_Native'] */
  tags: string[];
  /** 목록 순서(작을수록 위) */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 자동 분류 추천. 앱이 계산해서 보여 주고, 사용자가 확인하면 저장해요.
 * - assign: 이 해시태그를 이미 있는 카테고리에 넣자
 * - group: 이 해시태그들로 새 카테고리를 만들자(이름은 AI가 지어 줄 수 있어요)
 */
export type TagSuggestion =
  | { kind: 'assign'; tag: string; categoryId: string }
  | { kind: 'group'; tags: string[]; name?: string };

/** 사용자가 거절한 추천. id는 tagSuggestionKey 값이에요. */
export interface DismissedTagSuggestion {
  id: string;
  createdAt: string;
}
