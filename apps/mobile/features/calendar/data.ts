import {
  type CalendarEvent,
  type CalendarEventRow,
  type Card,
  fixtures,
  toCalendarEvent,
  toCalendarEventInsert,
} from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { listCards, saveCard } from '@/features/cards';
import { fromFixture, sourceFor } from '@/lib/data-source';
import { localFirstTable, onAccountChange } from '@/lib/local-first';

import { stripInlineHashtags } from './autoTags';
import {
  dayKey,
  overlaps,
  shiftDay,
  TIMEZONE,
  type TimeSlot,
  validateCalendarEventInput,
} from './model';
import {
  loadHiddenTagStore,
  seedExplicitTagsFromTitle,
  setItemManualTags,
  updateCalendarTagCorpus,
} from './tagStore';
import taskExamples from './tasks.fixture.json';

// 일정은 로그인 전에는 이 기기에만, 로그인 후에는 기기와 계정(calendar_events) 둘 다에 저장해요.
// 노트에서 확인한 일정·할 일은 카드(cards)에서 가져와요. 카드도 같은 방식으로 저장돼요.
// 저장 방식은 lib/local-first.ts예요.
export const isCalendarRemote = sourceFor('calendar') === 'supabase';

const eventTable = localFirstTable<CalendarEvent>({
  feature: 'calendar',
  table: 'calendar_events',
  toRow: toCalendarEventInsert,
  fromRow: (row) => toCalendarEvent(row as CalendarEventRow),
});

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

export async function loadCalendar(options?: {
  silent?: boolean;
  forceTagStore?: boolean;
}): Promise<void> {
  if (pending) return pending;
  const isSilent = Boolean(options?.silent && !state.loading);
  if (!isSilent) {
    publish({ ...state, loading: true, error: '' });
  }
  pending = (async () => {
    try {
      await loadHiddenTagStore(options?.forceTagStore ? { force: true } : undefined);
      if (isCalendarRemote) {
        const [storedEvents, allCards] = await Promise.all([eventTable.list(), listCards()]);
        const cards = allCards.filter(
          (card) => (card.type === 'event' || card.type === 'task') && card.status !== 'dismissed',
        );
        const cardEvents: CalendarEvent[] = cards
          .filter(
            (card): card is Card & { startAt: string } =>
              card.type === 'event' && card.status === 'confirmed' && Boolean(card.startAt),
          )
          .map((card) => ({
            id: `card-event:${card.id}`,
            calendarId: '노트 일정',
            title: card.title,
            startAt: card.startAt,
            endAt: card.endAt ?? new Date(Date.parse(card.startAt) + 3600000).toISOString(),
            allDay: false,
            timezone: TIMEZONE,
            source: 'google',
          }));
        const tasks = cards.filter((card) => card.type === 'task');
        const allRemoteEvents = [...storedEvents, ...cardEvents].sort((a, b) =>
          a.startAt.localeCompare(b.startAt),
        );
        for (const item of [...allRemoteEvents, ...tasks]) {
          void seedExplicitTagsFromTitle(item.id, item.title);
        }
        updateCalendarTagCorpus([...allRemoteEvents, ...tasks]);
        publish({
          events: allRemoteEvents,
          tasks,
          fixtureDay: undefined,
          loading: false,
          error: '',
        });
        return;
      }

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
          id: 'demo-kickoff',
          dayOffset: -5,
          title: '월간 로드맵 킥오프 미팅',
          startAt: '09:30',
          endAt: '11:00',
        },
        {
          id: 'demo-gym-1',
          dayOffset: -5,
          title: '퇴근 후 헬스장 근력 루틴',
          startAt: '19:00',
          endAt: '20:00',
        },
        {
          id: 'demo-cal-arch',
          dayOffset: -4,
          title: '캘린더 아키텍처 및 디자인 리뷰',
          startAt: '10:00',
          endAt: '11:30',
        },
        {
          id: 'demo-run-1',
          dayOffset: -4,
          title: '저녁 5km 한강 조깅',
          startAt: '18:30',
          endAt: '19:30',
        },
        {
          id: 'demo-lunch-mentor',
          dayOffset: -3,
          title: '선배 개발자와 점심 네트워킹',
          startAt: '12:00',
          endAt: '13:00',
        },
        {
          id: 'demo-algo-study',
          dayOffset: -3,
          title: '그래프 이론 알고리즘 스터디',
          startAt: '20:00',
          endAt: '21:30',
        },
        {
          id: 'demo-backend-review',
          dayOffset: -2,
          title: '백엔드 API 및 코드 리뷰 세션',
          startAt: '10:00',
          endAt: '11:00',
        },
        {
          id: 'demo-ai-workshop',
          dayOffset: -2,
          title: 'AI 기능 기획 및 사용자 흐름 워크숍',
          startAt: '13:30',
          endAt: '14:30',
        },
        {
          id: 'demo-paper-seminar',
          dayOffset: -2,
          title: 'Obsidian 지식 그래프 논문 세미나',
          startAt: '20:30',
          endAt: '21:30',
        },
        {
          id: 'demo-morning',
          dayOffset: -1,
          title: '아침 러닝과 스트레칭',
          startAt: '07:00',
          endAt: '08:00',
        },
        {
          id: 'demo-perf-pair',
          dayOffset: -1,
          title: '프론트엔드 성능 최적화 페어 코딩',
          startAt: '13:00',
          endAt: '14:00',
        },
        {
          id: 'demo-book-club',
          dayOffset: -1,
          title: '기술 서적 클린 아키텍처 독서 모임',
          startAt: '21:00',
          endAt: '22:00',
        },
        {
          id: 'demo-morning-run',
          dayOffset: 0,
          title: '모닝 러닝 및 컨디션 체크',
          startAt: '07:00',
          endAt: '08:00',
        },
        {
          id: 'demo-lunch-design',
          dayOffset: 0,
          title: '디자인 팀과 점심 식사',
          startAt: '12:30',
          endAt: '13:30',
        },
        {
          id: 'demo-overlap-1',
          dayOffset: 0,
          title: '예시 자료 검토 및 스펙 동기화',
          startAt: '15:00',
          endAt: '16:00',
        },
        {
          id: 'demo-ai-eval',
          dayOffset: 0,
          title: 'AI 추천 모델 성능 평가 스터디',
          startAt: '19:30',
          endAt: '21:00',
        },
        {
          id: 'demo-yoga',
          dayOffset: 1,
          title: '아침 요가 및 코어 운동',
          startAt: '07:00',
          endAt: '08:00',
        },
        {
          id: 'demo-overlap-2',
          dayOffset: 1,
          title: '예시 팀 체크인 및 스프린트 점검',
          startAt: '14:00',
          endAt: '15:00',
        },
        {
          id: 'demo-deploy-mentor',
          dayOffset: 1,
          title: '백엔드 배포 파이프라인 멘토링',
          startAt: '19:00',
          endAt: '20:30',
        },
        {
          id: 'demo-ux-test',
          dayOffset: 2,
          title: '캘린더 주간 뷰 사용성 테스트',
          startAt: '10:00',
          endAt: '11:30',
        },
        {
          id: 'demo-team-retro',
          dayOffset: 3,
          title: '팀 점심 회식 및 중간 회고',
          startAt: '12:00',
          endAt: '13:00',
        },
        {
          id: 'demo-demo-rehearsal',
          dayOffset: 4,
          title: '중간 발표 리허설 및 피드백',
          startAt: '10:00',
          endAt: '11:30',
        },
        {
          id: 'demo-release-review',
          dayOffset: 5,
          title: '프로덕션 배포 전 통합 코드 리뷰',
          startAt: '15:00',
          endAt: '16:30',
        },
        {
          id: 'demo-weekly-retro',
          dayOffset: 6,
          title: '주간 기술 회고 및 다음 주 독서 계획',
          startAt: '16:00',
          endAt: '17:30',
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
      updateCalendarTagCorpus([...demoEvents, ...tasks]);
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
        fixtureDay: isSilent ? state.fixtureDay : undefined,
        loading: false,
        error: error instanceof Error ? error.message : '일정을 불러오지 못했어요.',
      });
    }
  })();
  await pending;
  pending = undefined;
}
// 로그인·로그아웃하면 그 계정(또는 이 기기)의 일정으로 다시 불러요.
onAccountChange(() => void loadCalendar({ forceTagStore: true }));

export async function refreshCalendar(): Promise<void> {
  if (isCalendarRemote) {
    await loadCalendar({ silent: !state.loading });
    return;
  }
  if (state.loading || (state.fixtureDay && state.fixtureDay !== dayKey(new Date()))) {
    await loadCalendar();
  }
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
export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  await refreshCalendar();
  if (state.error) throw new Error(state.error);
  return fromFixture([...state.events].sort((a, b) => a.startAt.localeCompare(b.startAt)));
}
export async function listCalendarTasks(): Promise<Card[]> {
  await refreshCalendar();
  if (state.error) throw new Error(state.error);
  return fromFixture(state.tasks);
}
export async function confirmTask(id: string): Promise<void> {
  const task = state.tasks.find((item) => item.id === id);
  if (isCalendarRemote && task) await saveCard({ ...task, status: 'confirmed' });
  publish({
    ...state,
    tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'confirmed' } : task)),
  });
}
function validateTaskSlot(task: Card, slot: TimeSlot, options?: { allowPastDue?: boolean }): void {
  if (
    !Number.isFinite(Date.parse(slot.startAt)) ||
    !Number.isFinite(Date.parse(slot.endAt)) ||
    Date.parse(slot.endAt) <= Date.parse(slot.startAt)
  ) {
    throw new Error('시간 범위를 확인해 주세요.');
  }
  if (Date.parse(slot.startAt) < Date.now()) {
    throw new Error('지난 시간이에요. 후보를 다시 골라 주세요.');
  }
  if (!options?.allowPastDue && task.dueAt && Date.parse(slot.endAt) > Date.parse(task.dueAt)) {
    throw new Error('마감 전 시간을 골라 주세요.');
  }
  const busy = [
    ...state.events,
    ...state.tasks.filter((item) => item.id !== task.id && item.status !== 'dismissed'),
  ];
  if (
    busy.some(
      (item) =>
        item.startAt && item.endAt && overlaps(slot.startAt, slot.endAt, item.startAt, item.endAt),
    )
  ) {
    throw new Error('다른 일정과 겹쳐요. 후보를 다시 골라 주세요.');
  }
}

export async function saveTimeSlot(
  id: string,
  slot: TimeSlot,
  options?: { allowPastDue?: boolean },
): Promise<void> {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || task.status !== 'confirmed') throw new Error('먼저 할 일 내용을 확인해 주세요.');
  validateTaskSlot(task, slot, options);
  const nextTask: Card = { ...task, startAt: slot.startAt, endAt: slot.endAt };
  if (isCalendarRemote) await saveCard(nextTask);
  publish({
    ...state,
    tasks: state.tasks.map((item) => (item.id === id ? nextTask : item)),
  });
}

/** 미확인 할 일도 한 번의 선택으로 확인하고 시간대에 바로 배정해요. */
export async function confirmAndSaveTimeSlot(
  id: string,
  slot: TimeSlot,
  options?: { allowPastDue?: boolean },
): Promise<void> {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) throw new Error('할 일을 찾지 못했어요.');
  validateTaskSlot(task, slot, options);
  const nextTask: Card = {
    ...task,
    status: 'confirmed',
    startAt: slot.startAt,
    endAt: slot.endAt,
  };
  if (isCalendarRemote) await saveCard(nextTask);
  publish({
    ...state,
    tasks: state.tasks.map((item) => (item.id === id ? nextTask : item)),
  });
}

/** 할 일에 배정된 시간을 비워 다시 미배정 목록으로 돌려보내요. */
export async function clearTaskTimeSlot(id: string): Promise<void> {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const nextTask: Card = { ...task, startAt: undefined, endAt: undefined };
  if (isCalendarRemote) await saveCard(nextTask);
  publish({
    ...state,
    tasks: state.tasks.map((item) => (item.id === id ? nextTask : item)),
  });
}

export async function saveCalendarEvent(event: CalendarEvent): Promise<void> {
  const { cleanTitle, tags } = stripInlineHashtags(event.title);
  const validatedTitle = validateCalendarEventInput({
    title: cleanTitle,
    startAt: event.startAt,
    endAt: event.endAt,
  });
  const cleanEvent: CalendarEvent = { ...event, title: validatedTitle };
  if (isCalendarRemote) await eventTable.put([cleanEvent]);
  if (tags.length > 0) {
    await setItemManualTags(cleanEvent.id, tags);
  }
  const exists = state.events.some((item) => item.id === cleanEvent.id);
  const events = (
    exists
      ? state.events.map((item) => (item.id === cleanEvent.id ? cleanEvent : item))
      : [...state.events, cleanEvent]
  ).sort((a, b) => a.startAt.localeCompare(b.startAt));
  updateCalendarTagCorpus([...events, ...state.tasks]);
  publish({
    ...state,
    events,
  });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  if (isCalendarRemote) await eventTable.remove([id]);
  const events = state.events.filter((item) => item.id !== id);
  updateCalendarTagCorpus([...events, ...state.tasks]);
  publish({
    ...state,
    events,
  });
}
