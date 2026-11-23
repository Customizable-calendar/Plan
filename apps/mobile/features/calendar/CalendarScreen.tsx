import type { CalendarEvent, Card } from '@noteapp/shared';
import {
  DualHandle,
  Fab,
  Icon,
  MonthGrid,
  SegmentTabs,
  SyncBanner,
  Text,
  WeekStrip,
  type Account,
  type MonthDay,
  type MonthEvent,
  type WeekDay,
} from '@noteapp/ui';
import { router, useFocusEffect } from 'expo-router';
import {
  CalendarPlusIcon,
  CheckSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HashIcon,
  MicIcon,
  PencilLineIcon,
  PlusIcon,
  SlidersHorizontalIcon,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, View } from 'react-native';

import { CalendarDayList } from './CalendarDayList';
import { CalendarDaySheet } from './CalendarDaySheet';
import { CalendarQuickMenu } from './CalendarQuickMenu';
import { CalendarSettingsSheet } from './CalendarSettingsSheet';
import { CalendarTimeline } from './CalendarTimeline';
import { HashtagGraphSheet } from './HashtagGraphSheet';
import { TimeCandidates } from './TimeCandidates';
import { confirmTask, loadCalendar, refreshCalendar, useCalendar } from './data';
import {
  dayKey,
  eventsOnDay,
  groupEventsByDay,
  shiftDay,
  shiftMonth,
  splitTitleAndTags,
  weekDays,
} from './model';

type LayoutMode = 'dual' | 'day' | 'month';
type ContentTab = '목록' | '시간표';
type TimelineSpan = 'day' | 'week';

const NEXT_LAYOUT: Record<LayoutMode, LayoutMode> = {
  month: 'dual',
  dual: 'day',
  day: 'month',
};

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const EMPTY_EVENTS: CalendarEvent[] = [];
const EMPTY_TASKS: Card[] = [];

const HANDLE_HEIGHT = 24;
const MONTH_HEADER_HEIGHT = 22;
const COMPACT_ROW_HEIGHT = 44;
const MONTH_TOP_PAD = 8;
const EXPAND_GRID_EXTRA_PX = 64;
const SNAP_TOP_RATIO = 0.14;
const SNAP_BOTTOM_RATIO = 0.84;
const SNAP_TOP_MIN_PX = 76;
const SNAP_BOTTOM_MIN_PX = 96;
const DRAG_THRESHOLD_PX = 5;

/** MonthGrid 헤더(일~토)에 맞춰 일요일 시작 주간 배열을 만들어요. */
function buildSundayMonthWeeks(monthStart: string): string[][] {
  const nextMonth = shiftMonth(monthStart, 1);
  const firstDow = new Date(`${monthStart}T12:00:00+09:00`).getUTCDay();
  const gridStart = shiftDay(monthStart, -firstDow);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => shiftDay(gridStart, w * 7 + d)),
  ).filter((w) => w[0] < nextMonth);
}

function createSplitPanResponder({
  restingTopHeight,
  usableHeight,
  onStart,
  onMove,
  onEnd,
  onCancel,
}: {
  restingTopHeight: number;
  usableHeight: number;
  onStart: (start: number) => void;
  onMove: (next: number) => void;
  onEnd: (finalHeight: number, vy: number, moved: boolean) => void;
  onCancel: () => void;
}) {
  let maxAbsDy = 0;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      maxAbsDy = 0;
      onStart(restingTopHeight);
    },
    onPanResponderMove: (_, g) => {
      const absDy = Math.abs(g.dy);
      if (absDy > maxAbsDy) maxAbsDy = absDy;
      if (maxAbsDy < DRAG_THRESHOLD_PX) return;
      const next = Math.max(0, Math.min(usableHeight, Math.round(restingTopHeight + g.dy)));
      onMove(next);
    },
    onPanResponderRelease: (_, g) => {
      const moved = maxAbsDy >= DRAG_THRESHOLD_PX;
      const finalHeight = Math.max(0, Math.min(usableHeight, Math.round(restingTopHeight + g.dy)));
      onEnd(finalHeight, g.vy, moved);
    },
    onPanResponderTerminate: () => {
      onCancel();
    },
  });
}

export function CalendarScreen() {
  const { events, tasks, loading, error } = useCalendar();
  useFocusEffect(
    useCallback(() => {
      void refreshCalendar();
    }, []),
  );

  const today = dayKey(new Date());
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('dual');
  const [splitHeight, setSplitHeight] = useState(0);
  const [splitRatio, setSplitRatio] = useState<number | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [contentTab, setContentTab] = useState<ContentTab>('목록');
  const [timelineSpan, setTimelineSpan] = useState<TimelineSpan>('day');
  const [fullDay, setFullDay] = useState(false);
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(() => new Set());
  const [quickMenuDay, setQuickMenuDay] = useState<string>();
  const [sheetTarget, setSheetTarget] = useState<{
    day: string;
    initialHour?: number;
    initialTab?: 'agenda' | 'add';
  }>();
  const [candidateTask, setCandidateTask] = useState<Card>();
  const [showHashtags, setShowHashtags] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [graphFocusTag, setGraphFocusTag] = useState<string>();

  const month = day.slice(0, 7);
  const monthStart = `${month}-01`;
  const yearNum = Number(day.slice(0, 4));
  const monthNum = Number(day.slice(5, 7));

  const monthWeeks = useMemo(() => buildSundayMonthWeeks(monthStart), [monthStart]);
  const currentWeekDays = useMemo(() => weekDays(day), [day]);

  const usableHeight = Math.max(240, (splitHeight > 0 ? splitHeight : 664) - HANDLE_HEIGHT);
  const compactCalendarHeight =
    MONTH_HEADER_HEIGHT + monthWeeks.length * COMPACT_ROW_HEIGHT + MONTH_TOP_PAD;
  const defaultDualHeight = Math.min(compactCalendarHeight, Math.round(usableHeight * 0.65));
  const restingTopHeight =
    layoutMode === 'day'
      ? 0
      : layoutMode === 'month'
        ? usableHeight
        : splitRatio !== null
          ? Math.round(Math.min(usableHeight, Math.max(0, splitRatio * usableHeight)))
          : defaultDualHeight;
  const isDragging = dragHeight !== null;
  const activeTopHeight = isDragging ? dragHeight : restingTopHeight;
  const showMonthPane = isDragging ? activeTopHeight > 4 : layoutMode !== 'day';
  const showBottomPane = isDragging ? usableHeight - activeTopHeight > 4 : layoutMode !== 'month';
  const isCompactGrid =
    !(layoutMode === 'month' && !isDragging) &&
    activeTopHeight < compactCalendarHeight + EXPAND_GRID_EXTRA_PX;

  const splitPanResponder = useMemo(
    () =>
      createSplitPanResponder({
        restingTopHeight,
        usableHeight,
        onStart: (start) => {
          setDragHeight(start);
        },
        onMove: (next) => {
          setDragHeight(next);
        },
        onEnd: (finalHeight, vy, moved) => {
          setDragHeight(null);
          if (!moved) {
            setSplitRatio(null);
            setLayoutMode((m) => NEXT_LAYOUT[m]);
            return;
          }
          const topSnapPx = Math.max(SNAP_TOP_MIN_PX, usableHeight * SNAP_TOP_RATIO);
          const bottomSnapPx = Math.max(SNAP_BOTTOM_MIN_PX, usableHeight * (1 - SNAP_BOTTOM_RATIO));
          if (finalHeight <= topSnapPx || (vy < -0.9 && finalHeight < usableHeight * 0.35)) {
            setLayoutMode('day');
            setSplitRatio(null);
            return;
          }
          if (
            usableHeight - finalHeight <= bottomSnapPx ||
            (vy > 0.9 && finalHeight > usableHeight * 0.65)
          ) {
            setLayoutMode('month');
            setSplitRatio(null);
            return;
          }
          setLayoutMode('dual');
          setSplitRatio(
            Math.min(SNAP_BOTTOM_RATIO, Math.max(SNAP_TOP_RATIO, finalHeight / usableHeight)),
          );
        },
        onCancel: () => {
          setDragHeight(null);
        },
      }),
    [restingTopHeight, usableHeight],
  );

  const monthEventsByDay = useMemo(
    () => groupEventsByDay(events, monthWeeks.flat()),
    [events, monthWeeks],
  );

  const scheduledTasksByDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const task of tasks) {
      if (task.status === 'dismissed' || !task.startAt) continue;
      const d = dayKey(task.startAt);
      const list = map.get(d);
      if (list) list.push(task);
      else map.set(d, [task]);
    }
    return map;
  }, [tasks]);

  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'dismissed' && !t.startAt),
    [tasks],
  );

  const monthGridWeeks = useMemo<MonthDay[][]>(
    () =>
      monthWeeks.map((week) =>
        week.map((d) => {
          const evs = monthEventsByDay.get(d) ?? EMPTY_EVENTS;
          const dayTasks = scheduledTasksByDay.get(d) ?? EMPTY_TASKS;
          const gridEvents: MonthEvent[] = [
            ...evs.map((ev) => ({
              account: (ev.calendarId === '노트 일정' ? 2 : 1) as Account,
              title: splitTitleAndTags(ev.title).cleanTitle,
            })),
            ...dayTasks.map((task) => ({
              account: task.status === 'suggested' ? undefined : (2 as Account),
              title: splitTitleAndTags(task.title).cleanTitle,
            })),
          ];
          return {
            date: Number(d.slice(-2)),
            out: !d.startsWith(month),
            events: gridEvents,
          };
        }),
      ),
    [month, monthEventsByDay, monthWeeks, scheduledTasksByDay],
  );

  const weekStripDays = useMemo<WeekDay[]>(() => {
    return currentWeekDays.map((d) => {
      const evs = eventsOnDay(events, d);
      const dayTasks = scheduledTasksByDay.get(d) ?? EMPTY_TASKS;
      const accounts: Account[] = [];
      if (evs.some((e) => e.calendarId !== '노트 일정')) accounts.push(1);
      if (
        evs.some((e) => e.calendarId === '노트 일정') ||
        dayTasks.some((t) => t.status !== 'suggested')
      ) {
        accounts.push(2);
      }
      const dow = WEEKDAY_NAMES[new Date(`${d}T12:00:00+09:00`).getUTCDay()];
      return {
        label: dow,
        date: Number(d.slice(-2)),
        accounts: accounts.length > 0 ? accounts : undefined,
      };
    });
  }, [currentWeekDays, events, scheduledTasksByDay]);

  const selectedDayEvents = useMemo(
    () => monthEventsByDay.get(day) ?? eventsOnDay(events, day),
    [day, events, monthEventsByDay],
  );
  const selectedDayTasks = useMemo(
    () => scheduledTasksByDay.get(day) ?? EMPTY_TASKS,
    [day, scheduledTasksByDay],
  );
  const sheetDayEvents = useMemo(
    () => (sheetTarget ? eventsOnDay(events, sheetTarget.day) : EMPTY_EVENTS),
    [events, sheetTarget],
  );

  const openDaySheet = (targetDay: string, initialHour?: number, initialTab?: 'agenda' | 'add') => {
    setDay(targetDay);
    setShowSettings(false);
    setSheetTarget({ day: targetDay, initialHour, initialTab });
  };

  const openTagGraph = (tag?: string) => {
    setCandidateTask(undefined);
    setSheetTarget(undefined);
    setShowSettings(false);
    setGraphFocusTag(tag);
    setShowHashtags(true);
  };

  const openSettings = () => {
    setCandidateTask(undefined);
    setSheetTarget(undefined);
    setShowHashtags(false);
    setShowSettings(true);
  };

  const handleToggleTaskCheck = (task: Card) => {
    if (task.status === 'suggested') {
      void confirmTask(task.id);
      return;
    }
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  };

  const handleSelectMonthDate = (dateNum: number) => {
    const nextDay = `${month}-${String(dateNum).padStart(2, '0')}`;
    setDay(nextDay);
    if (layoutMode === 'month') {
      setLayoutMode('dual');
      setSplitRatio(null);
    }
  };

  const handleLongPressMonthDate = (dateNum: number) => {
    const nextDay = `${month}-${String(dateNum).padStart(2, '0')}`;
    setDay(nextDay);
    setQuickMenuDay(nextDay);
  };

  const quickMenuActions = quickMenuDay
    ? [
        {
          icon: CalendarPlusIcon,
          label: '일정',
          onPress: () => {
            const targetDay = quickMenuDay;
            setQuickMenuDay(undefined);
            openDaySheet(targetDay, undefined, 'add');
          },
        },
        {
          icon: CheckSquareIcon,
          label: '할 일',
          onPress: () => {
            const targetDay = quickMenuDay;
            setQuickMenuDay(undefined);
            openDaySheet(targetDay, undefined, 'agenda');
          },
        },
        {
          icon: PencilLineIcon,
          label: '메모',
          onPress: () => {
            setQuickMenuDay(undefined);
            router.push('/notes');
          },
        },
        {
          icon: MicIcon,
          label: '녹음',
          onPress: () => {
            setQuickMenuDay(undefined);
            router.push('/stt');
          },
        },
      ]
    : [];

  const activeWeekIdx = useMemo(() => {
    const idx = monthWeeks.findIndex((w) => w.includes(day));
    return idx >= 0 ? idx + 1 : 1;
  }, [day, monthWeeks]);

  const selectedWeekIdx = Math.max(0, currentWeekDays.indexOf(day));
  const timetableLabel =
    timelineSpan === 'week'
      ? `${monthNum}월 ${activeWeekIdx}주차`
      : `${monthNum}월 ${Number(day.slice(8, 10))}일 ${
          WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()]
        }요일`;

  return (
    <View className="flex-1 bg-background">
      <View className="mx-auto w-full max-w-[960px] flex-1">
        <View className="h-14 flex-row items-center gap-1.5 border-b border-border px-3">
          <View className="flex-1 flex-row items-center gap-0.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              onPress={() => setDay(shiftMonth(monthStart, -1))}
              hitSlop={6}
              className="h-9 w-7 items-center justify-center rounded-md active:bg-muted"
            >
              <Icon as={ChevronLeftIcon} size={18} className="text-foreground" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="오늘 날짜로 이동"
              onPress={() => setDay(today)}
              className="px-1 py-1"
            >
              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                {yearNum}. {String(monthNum).padStart(2, '0')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              onPress={() => setDay(shiftMonth(monthStart, 1))}
              hitSlop={6}
              className="h-9 w-7 items-center justify-center rounded-md active:bg-muted"
            >
              <Icon as={ChevronRightIcon} size={18} className="text-foreground" />
            </Pressable>
          </View>

          <SegmentTabs
            items={['목록', '시간표']}
            active={contentTab}
            onChange={(next) => {
              setContentTab(next as ContentTab);
              if (layoutMode === 'month') {
                setLayoutMode('dual');
                setSplitRatio(null);
              }
            }}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="해시태그 연결망"
            onPress={() => openTagGraph()}
            className="h-9 w-9 items-center justify-center rounded-md active:bg-muted"
          >
            <Icon as={HashIcon} size={19} className="text-foreground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="해시태그 설정"
            onPress={openSettings}
            className="h-9 w-9 items-center justify-center rounded-md active:bg-muted"
          >
            <Icon as={SlidersHorizontalIcon} size={19} className="text-foreground" />
          </Pressable>
        </View>

        {loading ? (
          <View className="px-4 pt-2">
            <SyncBanner state="syncing" />
          </View>
        ) : null}

        {!!error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="일정 다시 불러오기"
            onPress={() => void loadCalendar()}
            className="px-4 pt-2"
          >
            <SyncBanner state="partial" text={error} />
          </Pressable>
        ) : null}

        <View
          className={isDragging ? 'flex-1 overflow-hidden select-none' : 'flex-1 overflow-hidden'}
          onLayout={(e) => {
            const nextH = Math.round(e.nativeEvent.layout.height);
            if (nextH > 0 && Math.abs(nextH - splitHeight) > 1) {
              setSplitHeight(nextH);
            }
          }}
        >
          {showMonthPane ? (
            <View
              className={
                layoutMode === 'month' && !isDragging
                  ? 'flex-1 overflow-hidden px-2 pt-2'
                  : 'overflow-hidden px-2 pt-2'
              }
              style={
                layoutMode === 'month' && !isDragging ? undefined : { height: activeTopHeight }
              }
            >
              <MonthGrid
                weeks={monthGridWeeks}
                selected={day.startsWith(month) ? Number(day.slice(-2)) : undefined}
                today={today.startsWith(month) ? Number(today.slice(-2)) : undefined}
                compact={isCompactGrid}
                onSelect={handleSelectMonthDate}
                onLongPress={handleLongPressMonthDate}
              />
            </View>
          ) : null}

          <View
            {...splitPanResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="달력 높이 조절 손잡이"
            accessibilityHint="위아래로 끌어 달력과 목록 비율을 조절하거나 눌러서 보기를 바꿉니다"
            className={
              isDragging
                ? 'cursor-row-resize touch-none select-none bg-primary-soft/50'
                : 'cursor-row-resize touch-none select-none'
            }
          >
            <View pointerEvents="none">
              <DualHandle />
            </View>
          </View>

          {showBottomPane ? (
            <View className="flex-1 overflow-hidden">
              {contentTab === '목록' ? (
                <CalendarDayList
                  day={day}
                  today={today}
                  events={selectedDayEvents}
                  dayTasks={selectedDayTasks}
                  unscheduledTasks={unscheduledTasks}
                  checkedTaskIds={checkedTaskIds}
                  onToggleTaskCheck={handleToggleTaskCheck}
                  onOpenDaySheet={openDaySheet}
                  onSelectTask={setCandidateTask}
                  onPressTag={openTagGraph}
                  onJumpToday={() => setDay(today)}
                  onOpenExecution={() =>
                    router.push({ pathname: '/execution', params: { date: day } })
                  }
                />
              ) : (
                <ScrollView className="flex-1" contentContainerClassName="pb-24">
                  <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-3">
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={timelineSpan === 'week' ? '이전 주' : '이전 날'}
                        onPress={() => setDay(shiftDay(day, timelineSpan === 'week' ? -7 : -1))}
                        className="h-8 w-8 items-center justify-center rounded-md active:bg-muted"
                      >
                        <Icon as={ChevronLeftIcon} size={16} className="text-foreground" />
                      </Pressable>
                      <Text
                        accessibilityRole="header"
                        className="text-base font-bold text-foreground"
                      >
                        {timetableLabel}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={timelineSpan === 'week' ? '다음 주' : '다음 날'}
                        onPress={() => setDay(shiftDay(day, timelineSpan === 'week' ? 7 : 1))}
                        className="h-8 w-8 items-center justify-center rounded-md active:bg-muted"
                      >
                        <Icon as={ChevronRightIcon} size={16} className="text-foreground" />
                      </Pressable>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setTimelineSpan((s) => (s === 'day' ? 'week' : 'day'))}
                        className="rounded-full border border-border bg-background px-2.5 py-1"
                      >
                        <Text className="text-xs font-semibold text-foreground">
                          {timelineSpan === 'day' ? '주간 보기' : '일간 보기'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setFullDay((v) => !v)}
                        className={`rounded-full border px-2.5 py-1 ${fullDay ? 'border-primary bg-primary-soft' : 'border-border bg-background'}`}
                      >
                        <Text
                          className={`text-xs font-semibold ${fullDay ? 'text-primary-soft-foreground' : 'text-foreground'}`}
                        >
                          {fullDay ? '07~22시' : '24시간'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openDaySheet(day, undefined, 'agenda')}
                        hitSlop={6}
                      >
                        <Text className="text-xs font-bold text-primary">상세</Text>
                      </Pressable>
                    </View>
                  </View>

                  {layoutMode === 'day' && timelineSpan === 'day' ? (
                    <View className="px-4 pb-2">
                      <WeekStrip
                        days={weekStripDays}
                        selected={selectedWeekIdx}
                        onSelect={(idx) => setDay(currentWeekDays[idx])}
                      />
                    </View>
                  ) : null}

                  <CalendarTimeline
                    days={timelineSpan === 'week' ? currentWeekDays : [day]}
                    events={events}
                    tasks={tasks}
                    compact={timelineSpan === 'week'}
                    fullDay={fullDay}
                    onSelectDayHeader={(nextDay) => {
                      setDay(nextDay);
                      setTimelineSpan('day');
                    }}
                    onSelectSlot={(targetDay, hr) => openDaySheet(targetDay, hr)}
                    onSelectTask={setCandidateTask}
                  />
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 일정 추가"
          onPress={() => openDaySheet(day, undefined, 'add')}
          className="absolute bottom-5 right-5"
        >
          <Fab icon={PlusIcon} size={52} />
        </Pressable>
      </View>

      {quickMenuDay ? (
        <CalendarQuickMenu
          dateLabel={String(Number(quickMenuDay.slice(-2)))}
          actions={quickMenuActions}
          onClose={() => setQuickMenuDay(undefined)}
        />
      ) : null}

      {candidateTask ? (
        <TimeCandidates
          task={candidateTask}
          day={sheetTarget?.day ?? day}
          onPressTag={openTagGraph}
          onClose={() => setCandidateTask(undefined)}
        />
      ) : sheetTarget ? (
        <CalendarDaySheet
          key={`${sheetTarget.day}:${sheetTarget.initialHour ?? 'd'}:${sheetTarget.initialTab ?? 'auto'}`}
          day={sheetTarget.day}
          initialHour={sheetTarget.initialHour}
          initialTab={sheetTarget.initialTab}
          events={sheetDayEvents}
          tasks={tasks}
          onChangeDay={(nextDay) => openDaySheet(nextDay)}
          onSelectTask={setCandidateTask}
          onPressTag={openTagGraph}
          onClose={() => setSheetTarget(undefined)}
        />
      ) : showHashtags ? (
        <HashtagGraphSheet
          events={events}
          tasks={tasks}
          initialTag={graphFocusTag}
          onClose={() => {
            setShowHashtags(false);
            setGraphFocusTag(undefined);
          }}
        />
      ) : showSettings ? (
        <CalendarSettingsSheet onClose={() => setShowSettings(false)} />
      ) : null}
    </View>
  );
}
