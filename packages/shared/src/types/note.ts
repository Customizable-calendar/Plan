/** 사용자가 막 쓴 메모 원문. 원문은 고치지 않아요. (담당: A) */
export interface Note {
  id: string;
  text: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
  /** 리마인드 알림. 없으면 알림 없음 */
  reminder?: NoteReminder;
  /** 함께 보는 사람의 이메일. 없으면 나만 봐요. */
  collaborators?: string[];
}

/** 메모 리마인드. 시각은 UTC로, 시간대는 따로 저장해요. */
export interface NoteReminder {
  /** ISO 8601 (UTC) */
  at: string;
  /** IANA 시간대. 예: 'Asia/Seoul' */
  timeZone: string;
}
