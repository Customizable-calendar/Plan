/** 사용자가 막 쓴 메모 원문. 원문은 고치지 않아요. (담당: A) */
export interface Note {
  id: string;
  text: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
}
