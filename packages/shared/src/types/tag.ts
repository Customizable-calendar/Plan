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
