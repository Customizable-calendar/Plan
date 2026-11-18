/**
 * 받아쓴 글에 쓰는 내 지시문. 예: "회의록으로 정리", "할 일만 뽑기", "메일 초안".
 * 받아쓴 글에 지시문을 적용하면 팀 AI가 새 글을 만들어요. 받아쓴 글은 그대로 둬요.
 * (테이블·화면: B, Whispering의 transformation 참고)
 */
export interface SttTransform {
  id: string;
  /** 버튼에 보이는 이름. 1~40자 */
  title: string;
  /** AI에 주는 지시문. 1~4000자 */
  instructions: string;
  /** 목록 순서(작을수록 앞) */
  order: number;
  createdAt: string;
  updatedAt: string;
}
