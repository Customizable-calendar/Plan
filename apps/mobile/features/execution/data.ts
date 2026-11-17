import {
  type Card,
  type ExecutionRecord,
  type ExecutionRecordRow,
  fixtures,
  toExecutionRecord,
  toExecutionRecordInsert,
} from '@noteapp/shared';

import { dayKey, listCalendarTasks } from '@/features/calendar';
import { fromFixture, sourceFor } from '@/lib/data-source';
import { localFirstTable } from '@/lib/local-first';

// 수행 기록은 로그인 전에는 이 기기에만, 로그인 후에는 기기와 계정(exec_records) 둘 다에 저장해요.
export const isExecutionRemote = sourceFor('execution') === 'supabase';

const recordTable = localFirstTable<ExecutionRecord>({
  feature: 'execution',
  table: 'exec_records',
  toRow: toExecutionRecordInsert,
  fromRow: (row) => toExecutionRecord(row as ExecutionRecordRow),
});

let saved: ExecutionRecord[] | undefined;

export async function listExecutionRecords(): Promise<ExecutionRecord[]> {
  if (isExecutionRemote) {
    const rows = await recordTable.list();
    return [...rows].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }
  if (!saved) {
    const tasks = await listCalendarTasks();
    const results = ['done', 'partial', 'not_done', 'unknown'] as const;
    saved = tasks.map((task, index) => ({
      ...fixtures.executions[0],
      id: `exec-${task.id}`,
      cardId: task.id,
      result: results[index % results.length],
      actualMinutes: undefined,
      recordedAt: new Date().toISOString(),
    }));
  }
  return fromFixture(saved);
}

export async function loadExecution(
  day: string,
): Promise<{ tasks: Card[]; records: ExecutionRecord[] }> {
  const [tasks, records] = await Promise.all([listCalendarTasks(), listExecutionRecords()]);
  const recordDayByCard = new Map<string, string>();
  for (const record of records) {
    if (!recordDayByCard.has(record.cardId)) {
      recordDayByCard.set(record.cardId, dayKey(record.recordedAt));
    }
  }
  return {
    tasks: tasks.filter((task) => {
      const planned = task.startAt ?? task.dueAt;
      const recordedDay = recordDayByCard.get(task.id);
      return planned
        ? dayKey(planned) === day && (task.status === 'confirmed' || recordedDay !== undefined)
        : recordedDay === day;
    }),
    records,
  };
}

export async function saveExecutionRecords(records: ExecutionRecord[]): Promise<void> {
  if (records.some((record) => !['done', 'partial', 'not_done', 'unknown'].includes(record.result)))
    throw new Error('수행 상태를 확인해 주세요.');
  if (records.length === 0) return;

  if (isExecutionRemote) {
    const existing = await recordTable.list();
    const byCard = new Map(existing.map((record) => [record.cardId, record]));
    // 같은 할 일의 기존 기록 ID를 유지해 DB에 중복 행이 쌓이지 않게 해요.
    const normalized = records.map((record) => ({
      ...record,
      id: byCard.get(record.cardId)?.id ?? record.id,
    }));
    await recordTable.put(normalized);
    return;
  }

  const previous = await listExecutionRecords();
  const updatedIds = new Set(records.map((record) => record.cardId));
  // 같은 할 일의 상태를 다시 저장하면 기존 기록을 갱신해요.
  saved = await fromFixture([...previous.filter((old) => !updatedIds.has(old.cardId)), ...records]);
}
