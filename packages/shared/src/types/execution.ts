/** 할 일을 실제로 했는지 기록해요. unknown은 실패로 세지 않아요. (담당: C) */
export type ExecutionResult = 'done' | 'partial' | 'not_done' | 'unknown';

export interface ExecutionRecord {
  id: string;
  /** 대상 할 일 카드 */
  cardId: string;
  result: ExecutionResult;
  actualMinutes?: number;
  memo?: string;
  recordedAt: string;
}
