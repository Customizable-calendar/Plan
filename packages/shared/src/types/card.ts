/** 메모에서 나눈 정보 한 장. (담당: B) */
export type CardType = 'event' | 'task' | 'person' | 'idea';

/** AI·규칙이 만든 카드는 suggested로 시작하고, 사용자가 확인해야 confirmed가 돼요. */
export type CardStatus = 'suggested' | 'confirmed' | 'dismissed';

/** 카드가 나온 원문 위치. 카드에서 원문으로 돌아갈 수 있게 해요. */
export interface CardSource {
  kind: 'note';
  noteId: string;
  /** 원문에서의 [시작, 끝) 글자 위치 */
  span: [number, number];
}

export interface Card {
  id: string;
  type: CardType;
  status: CardStatus;
  title: string;
  /** 일정 카드: 시작·끝 (ISO 8601, UTC) */
  startAt?: string;
  endAt?: string;
  /** 할 일 카드: 마감 (ISO 8601, UTC) */
  dueAt?: string;
  /** 사람 카드: 원문에 적힌 이름 그대로 */
  personName?: string;
  source: CardSource;
  createdAt: string;
}
