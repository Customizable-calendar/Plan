import { describe, expect, it } from 'vitest';

import {
  type ExecutionRecordRow,
  toExecutionRecord,
  toExecutionRecordInsert,
} from '../src/db/mappers/execution';
import { fixtures } from '../src';

function asRow(insert: ReturnType<typeof toExecutionRecordInsert>): ExecutionRecordRow {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    actual_minutes: null,
    memo: null,
    ...insert,
    // DB는 시각을 +00:00 형태로 돌려줘요.
    recorded_at: insert.recorded_at!.replace('Z', '+00:00'),
  } as ExecutionRecordRow;
}

describe('execution mapper', () => {
  it('예시 수행 기록이 DB를 다녀와도 같다', () => {
    for (const record of fixtures.executions) {
      const back = toExecutionRecord(asRow(toExecutionRecordInsert(record)));
      expect(back).toEqual(record);
    }
  });

  it('없는 값은 null로 보내고 undefined로 받는다', () => {
    const base = fixtures.executions[0];
    const insert = toExecutionRecordInsert({
      ...base,
      actualMinutes: undefined,
      memo: undefined,
    });
    expect(insert.actual_minutes).toBeNull();
    expect(insert.memo).toBeNull();
    const back = toExecutionRecord(asRow(insert));
    expect(back.actualMinutes).toBeUndefined();
    expect(back.memo).toBeUndefined();
  });
});
