import { fixtures, type CalendarEvent, type Card } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

import { dayKey, overlaps, type TimeSlot } from './model';
import taskExamples from './tasks.fixture.json';

type State = { events: CalendarEvent[]; tasks: Card[]; loading: boolean; error: string };
let state: State = { events: [], tasks: [], loading: true, error: '' };
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
function publish(next: State) {
  state = next;
  listeners.forEach((notify) => notify());
}
function requireFixtures() {
  if (dataSource !== 'fixtures') throw new Error('캘린더 데이터 연결은 M2에서 지원해요.');
}
export async function loadCalendar(): Promise<void> {
  if (pending) return pending;
  publish({ ...state, loading: true, error: '' });
  pending = (async () => {
    try {
      requireFixtures();
      const [events, cards] = await Promise.all([
        fromFixture(fixtures.events),
        fromFixture(fixtures.cards),
      ]);
      // 고정된 예시의 날짜를 오늘로 옮겨 처음 열어도 내용을 볼 수 있게 해요.
      const today = dayKey(new Date());
      const offset =
        Date.parse(`${today}T00:00:00+09:00`) - Date.parse('2026-10-27T00:00:00+09:00');
      const shift = (value: string) => new Date(Date.parse(value) + offset).toISOString();
      const template = cards.find((card) => card.id === 'card-2');
      if (!template) throw new Error('할 일 예시를 불러오지 못했어요.');
      const tasks: Card[] = taskExamples.map((example) => ({
        ...template,
        id: example.id,
        title: example.title,
        status: 'confirmed',
        createdAt: shift(template.createdAt),
        dueAt: new Date(`${today}T18:00:00+09:00`).toISOString(),
        ...(example.hour === undefined
          ? {}
          : {
              startAt: new Date(
                `${today}T${String(example.hour).padStart(2, '0')}:00:00+09:00`,
              ).toISOString(),
              endAt: new Date(
                `${today}T${String(example.hour + 1).padStart(2, '0')}:00:00+09:00`,
              ).toISOString(),
            }),
      }));
      publish({
        events: events.map((event) => ({
          ...event,
          startAt: shift(event.startAt),
          endAt: shift(event.endAt),
        })),
        tasks,
        loading: false,
        error: '',
      });
    } catch (error) {
      publish({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : '일정을 불러오지 못했어요.',
      });
    }
  })();
  await pending;
  pending = undefined;
}
export function useCalendar() {
  const snapshot = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (state.loading && !pending) void loadCalendar();
  }, []);
  return snapshot;
}
export async function listCalendarTasks(): Promise<Card[]> {
  if (state.loading) await loadCalendar();
  if (state.error) throw new Error(state.error);
  return fromFixture(state.tasks);
}
export async function confirmTask(id: string): Promise<void> {
  requireFixtures();
  publish({
    ...state,
    tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'confirmed' } : task)),
  });
}
export async function saveTimeSlot(id: string, slot: TimeSlot): Promise<void> {
  requireFixtures();
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.status !== 'confirmed') throw new Error('먼저 할 일 내용을 확인해 주세요.');
  if (
    !Number.isFinite(Date.parse(slot.startAt)) ||
    !Number.isFinite(Date.parse(slot.endAt)) ||
    Date.parse(slot.endAt) <= Date.parse(slot.startAt)
  )
    throw new Error('시간 범위를 확인해 주세요.');
  if (task.dueAt && Date.parse(slot.endAt) > Date.parse(task.dueAt))
    throw new Error('마감 전 시간을 골라 주세요.');
  const busy = [...state.events, ...state.tasks.filter((item) => item.id !== id)];
  if (
    busy.some(
      (item) =>
        item.startAt && item.endAt && overlaps(slot.startAt, slot.endAt, item.startAt, item.endAt),
    )
  )
    throw new Error('다른 일정과 겹쳐요. 후보를 다시 골라 주세요.');
  publish({
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === id ? { ...item, startAt: slot.startAt, endAt: slot.endAt } : item,
    ),
  });
}
