import type { CalendarEvent, Card } from '@noteapp/shared';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarDaySheet } from './CalendarDaySheet';
import { CalendarTimeline } from './CalendarTimeline';
import { HashtagGraphSheet } from './HashtagGraphSheet';
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

type CalendarViewMode = 'month' | 'week' | 'day' | 'list';
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const GRID_HEADERS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const EMPTY_EVENTS: CalendarEvent[] = [];
const VIEW_TABS: readonly { key: CalendarViewMode; label: string }[] = [
  { key: 'month', label: '월' },
  { key: 'week', label: '주' },
  { key: 'day', label: '일' },
  { key: 'list', label: '목록' },
];

function ActionButton({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-10 items-center justify-center rounded-lg border px-3.5 py-2 ${selected ? 'border-primary bg-primary' : 'border-border bg-card'}`}
    >
      <Text
        className={`text-sm font-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
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

export function CalendarScreen() {
  const { events, tasks, loading, error } = useCalendar();
  const today = dayKey(new Date());
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<CalendarViewMode>('month');
  const [fullDay, setFullDay] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<{ day: string; initialHour?: number }>();
  const [candidateTask, setCandidateTask] = useState<Card>();
  const [showHashtags, setShowHashtags] = useState(false);

  const month = day.slice(0, 7);
  const monthStart = `${month}-01`;
  const days = useMemo(() => weekDays(day), [day]);
  const monthWeeks = useMemo(() => {
    const nextMonth = shiftMonth(monthStart, 1);
    const gridStart = weekDays(monthStart)[0];
    return Array.from({ length: 6 }, (_, w) => weekDays(shiftDay(gridStart, w * 7))).filter(
      (w) => w[0] < nextMonth,
    );
  }, [monthStart]);

  const scheduledTaskDays = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.status !== 'dismissed' && Boolean(t.startAt))
          .map((t) => dayKey(t.startAt!)),
      ),
    [tasks],
  );

  const monthEventsByDay = useMemo(
    () =>
      view === 'month'
        ? groupEventsByDay(events, monthWeeks.flat())
        : new Map<string, CalendarEvent[]>(),
    [events, monthWeeks, view],
  );

  const weekEventsByDay = useMemo(() => groupEventsByDay(events, days), [days, events]);
  const sheetDayEvents = useMemo(
    () => (sheetTarget ? eventsOnDay(events, sheetTarget.day) : EMPTY_EVENTS),
    [events, sheetTarget],
  );

  const titleText =
    view === 'month'
      ? `${Number(day.slice(5, 7))}월`
      : view === 'week'
        ? `${Number(day.slice(5, 7))}월 주간`
        : view === 'day'
          ? `${Number(day.slice(8, 10))}일 ${WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()]}요일`
          : '주간 일정 목록';

  const movePeriod = (dir: number) =>
    setDay(
      view === 'month'
        ? shiftMonth(monthStart, dir)
        : shiftDay(day, dir * (view === 'week' || view === 'list' ? 7 : 1)),
    );

  const openDaySheet = useCallback((targetDay: string, initialHour?: number) => {
    setDay(targetDay);
    setSheetTarget({ day: targetDay, initialHour });
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-12"
    >
      <View className="flex-row flex-wrap items-end justify-between gap-2">
        <View>
          <Text className="text-sm text-muted-foreground">
            {view === 'month'
              ? `${Number(day.slice(0, 4))}년`
              : `${Number(day.slice(0, 4))}년 ${Number(day.slice(5, 7))}월`}
          </Text>
          <Text
            accessibilityRole="header"
            className="text-[26px] font-bold tracking-tight text-foreground"
          >
            {titleText}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {day !== today && <ActionButton label="오늘" onPress={() => setDay(today)} />}
          <ActionButton label="해시태그 연결망" onPress={() => setShowHashtags(true)} />
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
                onPress={() => setView(tab.key)}
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

      {loading && <ActivityIndicator accessibilityLabel="일정 불러오는 중" />}
      {!!error && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text accessibilityRole="alert" className="text-sm text-foreground">
            {error}
          </Text>
          <ActionButton label="다시 시도" onPress={() => void loadCalendar()} />
        </View>
      )}

      {!loading && !error && view === 'month' && (
        <MonthCalendarGrid
          month={month}
          today={today}
          selectedDay={day}
          weeks={monthWeeks}
          eventsByDay={monthEventsByDay}
          scheduledTaskDays={scheduledTaskDays}
          onSelectDay={openDaySheet}
        />
      )}

      {!loading && !error && view === 'week' && (
        <CalendarTimeline
          days={days}
          events={events}
          compact
          fullDay={fullDay}
          onSelectSlot={openDaySheet}
        />
      )}

      {!loading && !error && view === 'day' && (
        <View className="gap-3">
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
                  onPress={() => (selected ? openDaySheet(date) : setDay(date))}
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
          <View className="flex-row items-center justify-between gap-2">
            <Text accessibilityRole="header" className="text-base font-bold text-foreground">
              {DayLabel(day)}
            </Text>
            <ActionButton label="날짜 상세 / 할 일" onPress={() => openDaySheet(day)} />
          </View>
          <CalendarTimeline
            days={[day]}
            events={events}
            fullDay={fullDay}
            onSelectSlot={openDaySheet}
          />
        </View>
      )}

      {!loading && !error && view === 'list' && (
        <EventListView days={days} eventsByDay={weekEventsByDay} onSelectDay={openDaySheet} />
      )}

      {candidateTask ? (
        <TimeCandidates
          task={candidateTask}
          day={sheetTarget?.day ?? day}
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
          onClose={() => setSheetTarget(undefined)}
        />
      ) : showHashtags ? (
        <HashtagGraphSheet events={events} tasks={tasks} onClose={() => setShowHashtags(false)} />
      ) : null}
    </ScrollView>
  );
}

function MonthCalendarGrid({
  month,
  today,
  selectedDay,
  weeks,
  eventsByDay,
  scheduledTaskDays,
  onSelectDay,
}: {
  month: string;
  today: string;
  selectedDay: string;
  weeks: string[][];
  eventsByDay: Map<string, CalendarEvent[]>;
  scheduledTaskDays: Set<string>;
  onSelectDay: (day: string) => void;
}) {
  return (
    <View
      accessibilityLabel="월간 캘린더"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <View className="flex-row border-b border-border bg-muted">
        {GRID_HEADERS.map((label) => (
          <View key={label} className="flex-1 items-center py-2">
            <Text className="text-xs font-bold text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0]} className="flex-row border-t border-border">
          {week.map((date, i) => {
            const dayEvents = eventsByDay.get(date) ?? EMPTY_EVENTS;
            const hasTask = scheduledTaskDays.has(date);
            const inMonth = date.startsWith(month);
            const isToday = date === today;
            const isSelected = date === selectedDay;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${date} 일정 ${dayEvents.length}개 열기`}
                onPress={() => onSelectDay(date)}
                className={`min-h-[96px] flex-1 gap-1 p-1.5 active:bg-muted/60 ${i > 0 ? 'border-l border-border' : ''} ${!inMonth ? 'bg-muted/30 opacity-50' : isSelected ? 'bg-primary-soft/25' : 'bg-card'}`}
              >
                <View className="flex-row items-center justify-between">
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
                </View>

                <View className="gap-1">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <View
                      key={ev.id}
                      className="rounded-sm border-l-2 border-l-cal-1 bg-cal-1-soft px-1.5 py-0.5"
                    >
                      <Text numberOfLines={1} className="text-[11px] font-semibold text-foreground">
                        {splitTitleAndTags(ev.title).cleanTitle}
                      </Text>
                    </View>
                  ))}
                  {dayEvents.length > 2 && (
                    <Text className="px-1 text-[10px] font-semibold text-muted-foreground">
                      +{dayEvents.length - 2}개 더보기
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function EventListView({
  days,
  eventsByDay,
  onSelectDay,
}: {
  days: string[];
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectDay: (day: string) => void;
}) {
  const grouped = days
    .map((d) => ({ d, ev: eventsByDay.get(d) ?? EMPTY_EVENTS }))
    .filter((item) => item.ev.length > 0);

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
      {grouped.map(({ d, ev }) => (
        <Pressable
          key={d}
          accessibilityRole="button"
          accessibilityLabel={`${DayLabel(d)} 일정 ${ev.length}개 열기`}
          onPress={() => onSelectDay(d)}
          className="gap-2.5 rounded-xl border border-border bg-card p-4"
        >
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            {DayLabel(d)} ({ev.length}개)
          </Text>
          {ev.map((event) => {
            const { cleanTitle, tags } = splitTitleAndTags(event.title);
            return (
              <View
                key={event.id}
                className="flex-row items-center gap-3 rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft px-3 py-2.5"
              >
                <Text className="w-24 text-xs font-bold text-muted-foreground">
                  {event.allDay
                    ? '종일'
                    : `${timeLabel(event.startAt)} ~ ${timeLabel(event.endAt)}`}
                </Text>
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                  {tags.length > 0 && (
                    <View className="flex-row flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <View key={tag} className="rounded-sm bg-muted px-2 py-0.5">
                          <Text className="text-[11px] font-semibold text-muted-foreground">
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View className="rounded-sm bg-card px-2 py-0.5">
                  <Text className="text-[11px] font-bold text-cal-1">캘린더</Text>
                </View>
              </View>
            );
          })}
        </Pressable>
      ))}
    </View>
  );
}
