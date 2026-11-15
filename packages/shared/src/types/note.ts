/** 사용자가 막 쓴 메모 원문. 원문은 고치지 않아요. (담당: A) */
export interface Note {
  id: string;
  text: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
  /** 리마인드 알림. 여러 날을 고를 수 있어서 목록이에요. 없으면 알림 없음 */
  reminders?: NoteReminder[];
  /** 함께 보는 사람의 이메일. 없으면 나만 봐요. */
  collaborators?: string[];
  /** 사용자가 고른 해시태그. '#'을 붙인 그대로예요. 원문(text)은 고치지 않고 여기에 따로 둬요. */
  tags?: string[];
  /** 별을 누른 시각. ISO 8601 (UTC). 없으면 중요한 메모가 아니에요. */
  importantAt?: string;
  /** 휴지통에 넣은 시각. ISO 8601 (UTC). 없으면 휴지통에 없어요. */
  trashedAt?: string;
  /** 체크리스트나 세션으로 옮겨서 기록에서 뺀 메모. 원문은 그대로 남아요. */
  movedTo?: 'checklist' | 'session';
}

/** 체크리스트 항목 하나 */
export interface NoteChecklistItem {
  text: string;
  checked: boolean;
}

/** 메모에서 만든 체크리스트. 메모 줄마다 항목 하나가 돼요. */
export interface NoteChecklist {
  id: string;
  /** 어느 메모에서 왔는지 (Note.id) */
  noteId: string;
  items: NoteChecklistItem[];
  /** ISO 8601 (UTC) */
  createdAt: string;
}

/** 메모 리마인드. 시각은 UTC로, 시간대는 따로 저장해요. */
export interface NoteReminder {
  /** ISO 8601 (UTC) */
  at: string;
  /** IANA 시간대. 예: 'Asia/Seoul' */
  timeZone: string;
}
