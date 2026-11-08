import { fixtures, type Card, type ExecutionRecord } from '@noteapp/shared';

import { dayKey, listCalendarTasks } from '@/features/calendar';
import { dataSource, fromFixture } from '@/lib/data-source';

let saved: ExecutionRecord[] | undefined;
function requireFixtures() {
  if (dataSource !== 'fixtures') throw new Error('수행 기록 데이터 연결은 M2에서 지원해요.');
}
export async function listExecutionRecords(): Promise<ExecutionRecord[]> {
  requireFixtures();
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
  requireFixtures();
  if (records.some((record) => !['done', 'partial', 'not_done', 'unknown'].includes(record.result)))
    throw new Error('수행 상태를 확인해 주세요.');
  const previous = await listExecutionRecords();
  // 같은 할 일의 상태를 다시 저장하면 기존 기록을 갱신해요.
  saved = await fromFixture([
    ...previous.filter((old) => !records.some((record) => record.cardId === old.cardId)),
    ...records,
  ]);
}
