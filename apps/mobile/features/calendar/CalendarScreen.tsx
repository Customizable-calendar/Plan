import type { CalendarEvent, Card } from '@noteapp/shared';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarDaySheet } from './CalendarDaySheet';
import { CalendarTimeline } from './CalendarTimeline';
import { HashtagGraphSheet } from './HashtagGraphSheet';
import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import { TimeCandidates } from './TimeCandidates';
import { loadCalendar, useCalendar } from './data';
import {
  dayKey,
  eventsOnDay,
  groupEventsByDay,
  shiftDay,
  shiftMonth,
  splitTitleAndTags,
  timeLabel,
  weekDays,
} from './model';

type CalendarViewMode = 'day' | 'week' | 'month' | 'list';
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const GRID_HEADERS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const EMPTY_EVENTS: CalendarEvent[] = [];
const VIEW_TABS: readonly { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'list', label: '목록' },
];

function ActionButton({
  label,
  selected = false,
  compact = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`items-center justify-center rounded-lg border ${compact ? 'min-h-8 px-2.5 py-1' : 'min-h-10 px-3.5 py-2'} ${selected ? 'border-primary bg-primary' : 'border-border bg-card'}`}
    >
      <Text
        className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DayLabel(day: string) {
  const w = WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${w})`;
}

function buildMonthWeeks(monthStart: string): string[][] {
  const nextMonth = shiftMonth(monthStart, 1);
  const gridStart = weekDays(monthStart)[0];
  return Array.from({ length: 6 }, (_, w) => weekDays(shiftDay(gridStart, w * 7))).filter(
    (w) => w[0] < nextMonth,
  );
}

export function CalendarScreen() {
  const { events, tasks, loading, error } = useCalendar();
  const today = dayKey(new Date());
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<CalendarViewMode>('day');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerMonthStart, setDrawerMonthStart] = useState(() => `${today.slice(0, 7)}-01`);
  const [fullDay, setFullDay] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<{ day: string; initialHour?: number }>();
  const [candidateTask, setCandidateTask] = useState<Card>();
  const [showHashtags, setShowHashtags] = useState(false);
  const [graphFocusTag, setGraphFocusTag] = useState<string>();

  const month = day.slice(0, 7);
  const monthStart = `${month}-01`;
  const drawerMonth = drawerMonthStart.slice(0, 7);

  const days = useMemo(() => weekDays(day), [day]);
  const monthWeeks = useMemo(() => buildMonthWeeks(monthStart), [monthStart]);
  const drawerWeeks = useMemo(() => buildMonthWeeks(drawerMonthStart), [drawerMonthStart]);

  const activeWeekNumber = useMemo(() => {
    const idx = monthWeeks.findIndex((w) => w.includes(day));
    return idx >= 0 ? idx + 1 : 1;
  }, [day, monthWeeks]);

  const scheduledTaskDays = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.status !== 'dismissed' && Boolean(t.startAt))
          .map((t) => dayKey(t.startAt!)),
      ),
    [tasks],
  );

  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'dismissed' && !t.startAt),
    [tasks],
  );

  const monthEventsByDay = useMemo(
    () =>
      view === 'month'
        ? groupEventsByDay(events, monthWeeks.flat())
        : new Map<string, CalendarEvent[]>(),
    [events, monthWeeks, view],
  );

  const drawerEventsByDay = useMemo(
    () =>
      view !== 'month' && drawerOpen
        ? groupEventsByDay(events, drawerWeeks.flat())
        : new Map<string, CalendarEvent[]>(),
    [drawerOpen, drawerWeeks, events, view],
  );

  const weekEventsByDay = useMemo(() => groupEventsByDay(events, days), [days, events]);
  const sheetDayEvents = useMemo(
    () => (sheetTarget ? eventsOnDay(events, sheetTarget.day) : EMPTY_EVENTS),
    [events, sheetTarget],
  );

  const syncDay = useCallback((nextDay: string) => {
    setDay(nextDay);
    setDrawerMonthStart(`${nextDay.slice(0, 7)}-01`);
  }, []);

  const titleText =
    view === 'month'
      ? `${Number(day.slice(5, 7))}월`
      : view === 'week'
        ? `${Number(day.slice(5, 7))}월 ${activeWeekNumber}주차`
        : view === 'day'
          ? `${Number(day.slice(8, 10))}일 ${WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()]}요일`
          : '주간 일정 목록';

  const movePeriod = (dir: number) =>
    syncDay(
      view === 'month'
        ? shiftMonth(monthStart, dir)
        : shiftDay(day, dir * (view === 'week' || view === 'list' ? 7 : 1)),
    );

  const openDaySheet = useCallback(
    (targetDay: string, initialHour?: number) => {
      syncDay(targetDay);
      setSheetTarget({ day: targetDay, initialHour });
    },
    [syncDay],
  );

  const openTagGraph = useCallback((tag?: string) => {
    setCandidateTask(undefined);
    setSheetTarget(undefined);
    setGraphFocusTag(tag);
    setShowHashtags(true);
  }, []);

  const toggleDrawer = () => {
    if (!drawerOpen) setDrawerMonthStart(monthStart);
    setDrawerOpen((prev) => !prev);
  };

  const zoomWeek = (week: string[], preferredMonth: string) => {
    const target = week.includes(day)
      ? day
      : week.includes(today)
        ? today
        : (week.find((d) => d.startsWith(preferredMonth)) ?? week[0]);
    syncDay(target);
    setView('week');
    setDrawerOpen(false);
  };

  const zoomDay = (targetDay: string) => {
    syncDay(targetDay);
    setView('day');
    setDrawerOpen(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-12"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {view !== 'month' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: drawerOpen }}
            accessibilityLabel={drawerOpen ? '월간 달력 접기' : '월간 달력 펼치기'}
            onPress={toggleDrawer}
            className="flex-row flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2 active:bg-muted"
          >
            <View>
              <Text className="text-xs text-muted-foreground">
                {Number(day.slice(0, 4))}년 {Number(day.slice(5, 7))}월
              </Text>
              <Text
                accessibilityRole="header"
                className="text-xl font-bold tracking-tight text-foreground"
              >
                {titleText}
              </Text>
            </View>
            <View className="rounded-md bg-primary-soft px-2.5 py-1">
              <Text className="text-xs font-bold text-primary-soft-foreground">
                {drawerOpen ? '달력 접기' : '달력 펼치기'}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View>
            <Text className="text-sm text-muted-foreground">{Number(day.slice(0, 4))}년</Text>
            <Text
              accessibilityRole="header"
              className="text-[26px] font-bold tracking-tight text-foreground"
            >
              {titleText}
            </Text>
          </View>
        )}
        <View className="flex-row flex-wrap gap-2">
          {day !== today && <ActionButton label="오늘" onPress={() => syncDay(today)} />}
          <ActionButton label="해시태그 연결망" onPress={() => openTagGraph()} />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row rounded-lg bg-muted p-1">
          {VIEW_TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setView(tab.key);
                  if (tab.key === 'month') setDrawerOpen(false);
                }}
                className={`rounded-md px-4 py-2 ${active ? 'bg-background' : ''}`}
              >
                <Text
                  className={`text-sm ${active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          {(view === 'day' || view === 'week') && (
            <ActionButton
              label={fullDay ? '07~22시' : '24시간'}
              selected={fullDay}
              onPress={() => setFullDay((v) => !v)}
            />
          )}
          <ActionButton label="이전" onPress={() => movePeriod(-1)} />
          <ActionButton label="다음" onPress={() => movePeriod(1)} />
        </View>
      </View>

      {!loading && !error && view !== 'month' && drawerOpen && (
        <CompactMonthDrawer
          drawerMonthStart={drawerMonthStart}
          today={today}
          selectedDay={day}
          weeks={drawerWeeks}
          eventsByDay={drawerEventsByDay}
          scheduledTaskDays={scheduledTaskDays}
          onShiftMonth={(dir) => setDrawerMonthStart((m) => shiftMonth(m, dir))}
          onZoomWeek={(w) => zoomWeek(w, drawerMonth)}
          onZoomDay={zoomDay}
        />
      )}

      {loading && <ActivityIndicator accessibilityLabel="일정 불러오는 중" />}
      {!!error && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text accessibilityRole="alert" className="text-sm text-foreground">
            {error}
          </Text>
          <ActionButton label="다시 시도" onPress={() => void loadCalendar()} />
        </View>
      )}

      {!loading && !error && unscheduledTasks.length > 0 && (
        <TaskQuickBar
          tasks={unscheduledTasks}
          onSelectTask={setCandidateTask}
          onPressTag={openTagGraph}
        />
      )}

      {!loading && !error && view === 'month' && (
        <MonthCalendarGrid
          month={month}
          today={today}
          selectedDay={day}
          weeks={monthWeeks}
          eventsByDay={monthEventsByDay}
          scheduledTaskDays={scheduledTaskDays}
          onZoomWeek={(w) => zoomWeek(w, month)}
          onZoomDay={zoomDay}
          onOpenSheet={(date) => openDaySheet(date)}
        />
      )}

      {!loading && !error && view === 'week' && (
        <CalendarTimeline
          days={days}
          events={events}
          tasks={tasks}
          compact
          fullDay={fullDay}
          onSelectDayHeader={zoomDay}
          onSelectSlot={openDaySheet}
          onSelectTask={setCandidateTask}
        />
      )}

      {!loading && !error && view === 'day' && (
        <View className="gap-3">
          {!drawerOpen && (
            <View className="flex-row gap-1">
              {days.map((date, i) => {
                const dayEvents = weekEventsByDay.get(date) ?? EMPTY_EVENTS;
                const hasEvent = dayEvents.length > 0;
                const hasTask = scheduledTaskDays.has(date);
                const selected = date === day;
                return (
                  <Pressable
                    key={date}
                    accessibilityRole="button"
                    accessibilityLabel={`${date} 일정 ${dayEvents.length}개`}
                    accessibilityState={{ selected }}
                    onPress={() => (selected ? openDaySheet(date) : syncDay(date))}
                    className={`min-h-[60px] flex-1 items-center justify-center gap-0.5 rounded-lg py-1.5 ${selected ? 'bg-primary' : date === today ? 'border border-primary bg-muted' : 'bg-muted'}`}
                  >
                    <Text
                      className={`text-[11px] ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      {GRID_HEADERS[i]}
                    </Text>
                    <Text
                      className={`text-[15px] font-bold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {Number(date.slice(-2))}
                    </Text>
                    <View className="h-1.5 flex-row items-center gap-1">
                      {hasEvent && (
                        <View
                          className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-cal-1'}`}
                        />
                      )}
                      {hasTask && (
                        <View
                          className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-task'}`}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View className="flex-row items-center justify-between gap-2">
            <Text accessibilityRole="header" className="text-base font-bold text-foreground">
              {DayLabel(day)}
            </Text>
            <ActionButton label="날짜 상세 / 할 일" onPress={() => openDaySheet(day)} />
          </View>
          <CalendarTimeline
            days={[day]}
            events={events}
            tasks={tasks}
            fullDay={fullDay}
            onSelectSlot={openDaySheet}
            onSelectTask={setCandidateTask}
          />
        </View>
      )}

      {!loading && !error && view === 'list' && (
        <EventListView
          days={days}
          eventsByDay={weekEventsByDay}
          tasks={tasks}
          onSelectDay={openDaySheet}
          onSelectTask={setCandidateTask}
          onPressTag={openTagGraph}
        />
      )}

      {candidateTask ? (
        <TimeCandidates
          task={candidateTask}
          day={sheetTarget?.day ?? day}
          onPressTag={openTagGraph}
          onClose={() => setCandidateTask(undefined)}
        />
      ) : sheetTarget ? (
        <CalendarDaySheet
          key={`${sheetTarget.day}:${sheetTarget.initialHour ?? 'd'}`}
          day={sheetTarget.day}
          initialHour={sheetTarget.initialHour}
          events={sheetDayEvents}
          tasks={tasks}
          onChangeDay={openDaySheet}
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
      ) : null}
    </ScrollView>
  );
}

function CompactMonthDrawer({
  drawerMonthStart,
  today,
  selectedDay,
  weeks,
  eventsByDay,
  scheduledTaskDays,
  onShiftMonth,
  onZoomWeek,
  onZoomDay,
}: {
  drawerMonthStart: string;
  today: string;
  selectedDay: string;
  weeks: string[][];
  eventsByDay: Map<string, CalendarEvent[]>;
  scheduledTaskDays: Set<string>;
  onShiftMonth: (dir: number) => void;
  onZoomWeek: (week: string[]) => void;
  onZoomDay: (day: string) => void;
}) {
  const drawerMonth = drawerMonthStart.slice(0, 7);
  return (
    <View
      accessibilityLabel="빠른 월간 달력"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2">
        <View className="gap-0.5">
          <Text className="text-sm font-bold text-foreground">
            {Number(drawerMonthStart.slice(0, 4))}년 {Number(drawerMonthStart.slice(5, 7))}월
          </Text>
          <Text className="text-xs text-muted-foreground">
            주차를 누르면 주간, 날짜를 누르면 일간으로 이동해요.
          </Text>
        </View>
        <View className="flex-row gap-1.5">
          <ActionButton compact label="이전 달" onPress={() => onShiftMonth(-1)} />
          <ActionButton compact label="다음 달" onPress={() => onShiftMonth(1)} />
        </View>
      </View>

      <View className="flex-row border-b border-border bg-muted/50">
        <View className="w-11 items-center border-r border-border py-1.5">
          <Text className="text-xs font-bold text-muted-foreground">주</Text>
        </View>
        {GRID_HEADERS.map((label) => (
          <View key={label} className="flex-1 items-center py-1.5">
            <Text className="text-xs font-bold text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wIdx) => {
        const isCurrentWeek = week.includes(selectedDay);
        return (
          <View key={week[0]} className="flex-row border-t border-border">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${wIdx + 1}주차 주간 보기로 전환`}
              onPress={() => onZoomWeek(week)}
              className={`w-11 items-center justify-center border-r border-border active:bg-muted ${isCurrentWeek ? 'bg-primary-soft' : 'bg-muted/40'}`}
            >
              <Text
                className={`text-xs font-bold ${isCurrentWeek ? 'text-primary-soft-foreground' : 'text-foreground'}`}
              >
                {wIdx + 1}주
              </Text>
            </Pressable>
            {week.map((date) => {
              const hasEvent = (eventsByDay.get(date) ?? EMPTY_EVENTS).length > 0;
              const hasTask = scheduledTaskDays.has(date);
              const inMonth = date.startsWith(drawerMonth);
              const isToday = date === today;
              const isSelected = date === selectedDay;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${date} 일간 보기로 이동`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onZoomDay(date)}
                  className={`min-h-11 flex-1 items-center justify-center gap-0.5 py-1 active:bg-muted ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${isToday ? 'bg-primary' : isSelected ? 'border border-primary bg-primary-soft' : ''}`}
                  >
                    <Text
                      className={`text-xs font-bold ${isToday ? 'text-primary-foreground' : isSelected ? 'text-primary-soft-foreground' : 'text-foreground'}`}
                    >
                      {Number(date.slice(-2))}
                    </Text>
                  </View>
                  <View className="h-1.5 flex-row items-center gap-1">
                    {hasEvent && <View className="h-1.5 w-1.5 rounded-full bg-cal-1" />}
                    {hasTask && <View className="h-1.5 w-1.5 rounded-full bg-task" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function MonthCalendarGrid({
  month,
  today,
  selectedDay,
  weeks,
  eventsByDay,
  scheduledTaskDays,
  onZoomWeek,
  onZoomDay,
  onOpenSheet,
}: {
  month: string;
  today: string;
  selectedDay: string;
  weeks: string[][];
  eventsByDay: Map<string, CalendarEvent[]>;
  scheduledTaskDays: Set<string>;
  onZoomWeek: (week: string[]) => void;
  onZoomDay: (day: string) => void;
  onOpenSheet: (day: string) => void;
}) {
  return (
    <View
      accessibilityLabel="월간 캘린더"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <View className="flex-row border-b border-border bg-muted">
        <View className="w-11 items-center border-r border-border py-2">
          <Text className="text-xs font-bold text-muted-foreground">주</Text>
        </View>
        {GRID_HEADERS.map((label) => (
          <View key={label} className="flex-1 items-center py-2">
            <Text className="text-xs font-bold text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wIdx) => {
        const isCurrentWeek = week.includes(selectedDay);
        return (
          <View key={week[0]} className="flex-row border-t border-border">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${wIdx + 1}주차 주간 보기로 전환`}
              onPress={() => onZoomWeek(week)}
              className={`w-11 items-center justify-center border-r border-border active:bg-muted ${isCurrentWeek ? 'bg-primary-soft' : 'bg-muted/40'}`}
            >
              <Text
                className={`text-xs font-bold ${isCurrentWeek ? 'text-primary-soft-foreground' : 'text-foreground'}`}
              >
                {wIdx + 1}주
              </Text>
            </Pressable>
            {week.map((date) => {
              const dayEvents = eventsByDay.get(date) ?? EMPTY_EVENTS;
              const hasTask = scheduledTaskDays.has(date);
              const inMonth = date.startsWith(month);
              const isToday = date === today;
              const isSelected = date === selectedDay;
              return (
                <View
                  key={date}
                  className={`min-h-[96px] flex-1 gap-1 border-l border-border p-1.5 ${!inMonth ? 'bg-muted/30 opacity-50' : isSelected ? 'bg-primary-soft/25' : 'bg-card'}`}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${date} 일간 보기로 전환`}
                    onPress={() => onZoomDay(date)}
                    className="flex-row items-center justify-between rounded-md px-0.5 py-0.5 active:bg-muted"
                  >
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full ${isToday ? 'bg-primary' : ''}`}
                    >
                      <Text
                        className={`text-xs font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}
                      >
                        {Number(date.slice(-2))}
                      </Text>
                    </View>
                    {hasTask && <View className="h-1.5 w-1.5 rounded-full bg-task" />}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${date} 일정 ${dayEvents.length}개 상세 열기`}
                    onPress={() => onOpenSheet(date)}
                    className="min-h-[60px] flex-1 gap-1 pt-0.5 active:bg-muted/60"
                  >
                    {dayEvents.slice(0, 2).map((ev) => (
                      <View
                        key={ev.id}
                        className="rounded-sm border-l-2 border-l-cal-1 bg-cal-1-soft px-1.5 py-0.5"
                      >
                        <Text
                          numberOfLines={1}
                          className="text-[11px] font-semibold text-foreground"
                        >
                          {splitTitleAndTags(ev.title).cleanTitle}
                        </Text>
                      </View>
                    ))}
                    {dayEvents.length > 2 && (
                      <Text className="px-1 text-[10px] font-semibold text-muted-foreground">
                        +{dayEvents.length - 2}개 더보기
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function TaskQuickBar({
  tasks,
  onSelectTask,
  onPressTag,
}: {
  tasks: readonly Card[];
  onSelectTask: (task: Card) => void;
  onPressTag: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="gap-2.5 rounded-xl border border-border bg-card p-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center justify-between gap-2"
      >
        <View className="flex-row items-center gap-2">
          <View className="rounded-md bg-task-soft px-2 py-0.5">
            <Text className="text-[11px] font-bold text-task">할 일</Text>
          </View>
          <Text className="text-sm font-bold text-foreground">
            시간 안 잡은 할 일 {tasks.length}개
          </Text>
        </View>
        <View className="rounded-md border border-border bg-muted px-2.5 py-1">
          <Text className="text-xs font-semibold text-foreground">
            {expanded ? '접기' : '펼치기'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="gap-2 pt-1">
          {tasks.map((task) => {
            const { cleanTitle } = splitTitleAndTags(task.title);
            const dueText = task.dueAt
              ? `마감 ${dayKey(task.dueAt).slice(5)} ${timeLabel(task.dueAt)}`
              : undefined;
            return (
              <View
                key={task.id}
                className="gap-2 rounded-lg border border-border bg-background p-3"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                    {dueText ? (
                      <Text className="text-[11px] text-muted-foreground">{dueText}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelectTask(task)}
                    className="rounded-lg bg-primary px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-primary-foreground">시간 잡기</Text>
                  </Pressable>
                </View>
                <HiddenTagDisclosure
                  itemId={task.id}
                  title={task.title}
                  editable
                  compact
                  onPressTag={onPressTag}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function EventListView({
  days,
  eventsByDay,
  tasks,
  onSelectDay,
  onSelectTask,
  onPressTag,
}: {
  days: string[];
  eventsByDay: Map<string, CalendarEvent[]>;
  tasks: readonly Card[];
  onSelectDay: (day: string) => void;
  onSelectTask: (task: Card) => void;
  onPressTag: (tag: string) => void;
}) {
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

  const grouped = days
    .map((d) => ({
      d,
      ev: eventsByDay.get(d) ?? EMPTY_EVENTS,
      dayTasks: scheduledTasksByDay.get(d) ?? [],
    }))
    .filter((item) => item.ev.length > 0 || item.dayTasks.length > 0);

  if (grouped.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelectDay(days[0])}
        className="rounded-xl border border-border bg-card p-4"
      >
        <Text className="text-xs text-muted-foreground">
          이번 주에 등록된 일정이 없어요. 눌러서 일정을 추가하거나 할 일을 확인하세요.
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-3">
      {grouped.map(({ d, ev, dayTasks }) => {
        const totalCount = ev.length + dayTasks.length;
        return (
          <View key={d} className="gap-2.5 rounded-xl border border-border bg-card p-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${DayLabel(d)} 일정 ${totalCount}개 열기`}
              onPress={() => onSelectDay(d)}
              className="flex-row items-center justify-between gap-2"
            >
              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                {DayLabel(d)} ({totalCount}개)
              </Text>
              <Text className="text-xs font-semibold text-primary">상세 보기</Text>
            </Pressable>

            {ev.map((event) => {
              const { cleanTitle } = splitTitleAndTags(event.title);
              return (
                <View
                  key={event.id}
                  className="gap-1.5 rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft px-3 py-2.5"
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="w-24 text-xs font-bold text-muted-foreground">
                      {event.allDay
                        ? '종일'
                        : `${timeLabel(event.startAt)} ~ ${timeLabel(event.endAt)}`}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                    </View>
                    <View className="rounded-sm bg-card px-2 py-0.5">
                      <Text className="text-[11px] font-bold text-cal-1">캘린더</Text>
                    </View>
                  </View>
                  <HiddenTagDisclosure
                    itemId={event.id}
                    title={event.title}
                    compact
                    onPressTag={onPressTag}
                  />
                </View>
              );
            })}

            {dayTasks.map((task) => {
              const { cleanTitle } = splitTitleAndTags(task.title);
              return (
                <View
                  key={task.id}
                  className="gap-1.5 rounded-md border-l-[3px] border-l-task bg-task-soft px-3 py-2.5"
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="w-24 text-xs font-bold text-muted-foreground">
                      {task.startAt && task.endAt
                        ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                        : '시간 미정'}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                    </View>
                    <Pressable
                      onPress={() => onSelectTask(task)}
                      className="rounded-sm bg-card px-2 py-0.5"
                    >
                      <Text className="text-[11px] font-bold text-task">시간 변경</Text>
                    </Pressable>
                  </View>
                  <HiddenTagDisclosure
                    itemId={task.id}
                    title={task.title}
                    editable
                    compact
                    onPressTag={onPressTag}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
