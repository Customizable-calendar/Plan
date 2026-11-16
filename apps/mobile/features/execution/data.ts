import {
  type Card,
  type ExecutionRecord,
  type ExecutionRecordRow,
  fixtures,
  toExecutionRecord,
  toExecutionRecordInsert,
} from '@noteapp/shared';

import { dayKey, listCalendarTasks } from '@/features/calendar';
import { failed, signedIn } from '@/features/cards';
import { fromFixture, sourceFor } from '@/lib/data-source';

const TABLE = 'exec_records';
const remote = sourceFor('execution') === 'supabase';

let saved: ExecutionRecord[] | undefined;

export async function listExecutionRecords(): Promise<ExecutionRecord[]> {
  if (remote) {
    const supabase = await signedIn();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('recorded_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return [];
      failed('수행 기록을 불러오지', error);
    }
    return ((data ?? []) as ExecutionRecordRow[]).map(toExecutionRecord);
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
  return {
    tasks: tasks.filter((task) => {
      const planned = task.startAt ?? task.dueAt;
      return (
        (planned &&
          dayKey(planned) === day &&
          (task.status === 'confirmed' || records.some((record) => record.cardId === task.id))) ||
        (!planned &&
          records.some((record) => record.cardId === task.id && dayKey(record.recordedAt) === day))
      );
    }),
    records,
  };
}

export async function saveExecutionRecords(records: ExecutionRecord[]): Promise<void> {
  if (records.some((record) => !['done', 'partial', 'not_done', 'unknown'].includes(record.result)))
    throw new Error('수행 상태를 확인해 주세요.');
  if (remote) {
    if (records.length === 0) return;
    const supabase = await signedIn();
    const { error } = await supabase
      .from(TABLE)
      .upsert(records.map(toExecutionRecordInsert), { onConflict: 'user_id,id' });
    if (error) failed('수행 기록을 저장하지', error);
    return;
  }
  const previous = await listExecutionRecords();
  // 같은 할 일의 상태를 다시 저장하면 기존 기록을 갱신해요.
  saved = await fromFixture([
    ...previous.filter((old) => !records.some((record) => record.cardId === old.cardId)),
    ...records,
  ]);
}
