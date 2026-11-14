import { fixtures, type CalendarEvent, type Card } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

import { dayKey, overlaps, shiftDay, TIMEZONE, type TimeSlot } from './model';
import taskExamples from './tasks.fixture.json';

type State = {
  events: CalendarEvent[];
  tasks: Card[];
  loading: boolean;
  error: string;
  fixtureDay?: string;
};
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
      const cards = await fromFixture(fixtures.cards);
      const today = dayKey(new Date());
      const template = cards.find((card) => card.id === 'card-2');
      if (!template) throw new Error('할 일 예시를 불러오지 못했어요.');
      const tasks: Card[] = taskExamples.map((example) => {
        const date = shiftDay(today, example.dayOffset);
        return {
          ...template,
          id: example.id,
          title: example.title,
          status: 'confirmed',
          createdAt: new Date(`${date}T08:00:00+09:00`).toISOString(),
          dueAt: new Date(`${date}T18:00:00+09:00`).toISOString(),
          ...(example.hour === undefined
            ? {}
            : {
                startAt: new Date(
                  `${date}T${String(example.hour).padStart(2, '0')}:00:00+09:00`,
                ).toISOString(),
                endAt: new Date(
                  `${date}T${String(example.hour + 1).padStart(2, '0')}:00:00+09:00`,
                ).toISOString(),
              }),
        };
      });
      const demoEvents: CalendarEvent[] = [
        {
          id: 'demo-morning',
          dayOffset: -1,
          title: '예시 아침 산책',
          startAt: '07:00',
          endAt: '08:00',
        },
        {
          id: 'demo-overlap-1',
          dayOffset: 0,
          title: '예시 자료 검토 #기획 #자료검토',
          startAt: '15:00',
          endAt: '16:00',
        },
        {
          id: 'demo-overlap-2',
          dayOffset: 1,
          title: '예시 팀 체크인 #기획 #팀회의',
          startAt: '15:00',
          endAt: '16:00',
        },
      ].map(({ dayOffset, ...event }) => {
        const date = shiftDay(today, dayOffset);
        return {
          ...event,
          calendarId: 'demo',
          allDay: false,
          timezone: TIMEZONE,
          source: 'google' as const,
          startAt: new Date(`${date}T${event.startAt}:00+09:00`).toISOString(),
          endAt: new Date(`${date}T${event.endAt}:00+09:00`).toISOString(),
        };
      });
      publish({
        events: demoEvents,
        tasks,
        fixtureDay: today,
        loading: false,
        error: '',
      });
    } catch (error) {
      publish({
        ...state,
        fixtureDay: undefined,
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
  useEffect(() => {
    if (!snapshot.fixtureDay) return;
    // 화면을 열어 둔 상태에서도 서울 자정이 지나면 예시 날짜를 갱신해요.
    const nextMidnight = Date.parse(`${shiftDay(snapshot.fixtureDay, 1)}T00:00:00+09:00`);
    const timer = setTimeout(
      () => {
        if (state.fixtureDay !== dayKey(new Date())) void loadCalendar();
      },
      Math.max(0, nextMidnight - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [snapshot.fixtureDay]);
  return snapshot;
}
export async function listCalendarTasks(): Promise<Card[]> {
  if (state.loading || (state.fixtureDay && state.fixtureDay !== dayKey(new Date()))) {
    await loadCalendar();
  }
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
  if (Date.parse(slot.startAt) < Date.now())
    throw new Error('지난 시간이에요. 후보를 다시 골라 주세요.');
  if (task.dueAt && Date.parse(slot.endAt) > Date.parse(task.dueAt))
    throw new Error('마감 전 시간을 골라 주세요.');
  const busy = [
    ...state.events,
    ...state.tasks.filter((item) => item.id !== id && item.status !== 'dismissed'),
  ];
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
