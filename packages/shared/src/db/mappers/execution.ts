// exec_records 행(snake_case) ↔ 앱 ExecutionRecord(camelCase). (담당: C)
import type { ExecutionRecord } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type ExecutionRecordRow = Tables<'exec_records'>;
export type ExecutionRecordInsert = TablesInsert<'exec_records'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toExecutionRecord(row: ExecutionRecordRow): ExecutionRecord {
  const record: ExecutionRecord = {
    id: row.id,
    cardId: row.card_id,
    result: row.result,
    recordedAt: iso(row.recorded_at),
  };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.actual_minutes !== null) record.actualMinutes = row.actual_minutes;
  if (row.memo !== null) record.memo = row.memo;
  return record;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toExecutionRecordInsert(record: ExecutionRecord): ExecutionRecordInsert {
  return {
    id: record.id,
    card_id: record.cardId,
    result: record.result,
    actual_minutes: record.actualMinutes ?? null,
    memo: record.memo ?? null,
    recorded_at: record.recordedAt,
  };
}
