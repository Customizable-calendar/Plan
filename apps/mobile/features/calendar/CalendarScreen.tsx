import type { CalendarEvent, Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarTimeline } from './CalendarTimeline';
import { HashtagGraphSheet } from './HashtagGraphSheet';
import { TimeCandidates } from './TimeCandidates';
import { confirmTask, loadCalendar, useCalendar } from './data';
import {
  dayKey,
  eventsOnDay,
  shiftDay,
  shiftMonth,
  splitTitleAndTags,
  timeLabel,
  weekDays,
} from './model';

type CalendarViewMode = 'day' | 'week' | 'month' | 'list';
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const VIEW_TABS: readonly { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
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
  const [view, setView] = useState<CalendarViewMode>('day');
  const [fullDay, setFullDay] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [candidateTask, setCandidateTask] = useState<Card>();
  const [message, setMessage] = useState('');
  const [showHashtags, setShowHashtags] = useState(false);

  const days = weekDays(day);
  const month = day.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = shiftMonth(monthStart, 1);
  const gridStart = weekDays(monthStart)[0];
  const gridDays =
    view === 'month'
      ? Array.from({ length: 6 }, (_, w) => weekDays(shiftDay(gridStart, w * 7))).filter(
          (w) => w[0] < nextMonth,
        )
      : [days];

  const dayEvents = eventsOnDay(events, day);
  const dayTasks = tasks.filter(
    (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === day,
  );
  const unscheduled = tasks.filter((t) => t.status !== 'dismissed' && !t.startAt);
  const scheduled = tasks.filter((t) => t.status !== 'dismissed' && Boolean(t.startAt));
  const titleText =
    view === 'day'
      ? `${Number(day.slice(8, 10))}일 ${WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()]}요일`
      : view === 'week'
        ? `${Number(day.slice(5, 7))}월 주간 시간표`
        : view === 'month'
          ? `${Number(day.slice(0, 4))}년 ${Number(day.slice(5, 7))}월`
          : '주간 일정 목록';

  const movePeriod = (dir: number) =>
    setDay(
      view === 'month'
        ? shiftMonth(monthStart, dir)
        : shiftDay(day, dir * (view === 'week' || view === 'list' ? 7 : 1)),
    );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-12"
    >
      <View className="flex-row flex-wrap items-end justify-between gap-2">
        <View>
          <Text className="text-sm text-muted-foreground">
            {Number(day.slice(0, 4))}년 {Number(day.slice(5, 7))}월
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
          <ActionButton
            label="수행 확인"
            selected
            onPress={() => router.push({ pathname: '/execution', params: { date: day } })}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
        <Text className="text-xs text-muted-foreground">
          선택한 날 일정 {dayEvents.length + dayTasks.length}개, 미배정 할 일 {unscheduled.length}개
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일정 새로고침"
          onPress={() => void loadCalendar()}
        >
          <Text className="text-xs font-bold text-primary">새로고침</Text>
        </Pressable>
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
        <View className="flex-row gap-2">
          <ActionButton label="이전" onPress={() => movePeriod(-1)} />
          <ActionButton label="다음" onPress={() => movePeriod(1)} />
        </View>
      </View>

      {view !== 'list' &&
        gridDays.map((week, row) => (
          <View key={week[0]} className="flex-row gap-1">
            {week.map((date, i) => {
              const hasEvent = eventsOnDay(events, date).length > 0;
              const hasTask = tasks.some(
                (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === date,
              );
              const count =
                eventsOnDay(events, date).length +
                tasks.filter(
                  (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === date,
                ).length;
              const selected = date === day;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${date} ${count}개 일정`}
                  accessibilityState={{ selected }}
                  onPress={() => setDay(date)}
                  className={`flex-1 items-center justify-center gap-0.5 rounded-lg py-1.5 ${view === 'month' && row > 0 ? 'min-h-11' : 'min-h-[60px]'} ${selected ? 'bg-primary' : date === today ? 'border border-primary bg-muted' : 'bg-muted'} ${view === 'month' && !date.startsWith(month) ? 'opacity-50' : ''}`}
                >
                  {(view !== 'month' || row === 0) && (
                    <Text
                      className={`text-[11px] ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      {['월', '화', '수', '목', '금', '토', '일'][i]}
                    </Text>
                  )}
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
        ))}

      {loading && <ActivityIndicator accessibilityLabel="일정 불러오는 중" />}
      {!!error && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text accessibilityRole="alert" className="text-sm text-foreground">
            {error}
          </Text>
          <ActionButton label="다시 시도" onPress={() => void loadCalendar()} />
        </View>
      )}

      {!loading && !error && (view === 'day' || view === 'week') && (
        <View className="gap-2.5">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text accessibilityRole="header" className="text-base font-bold text-foreground">
              {view === 'day'
                ? `${DayLabel(day)} 시간표 (${dayEvents.length + dayTasks.length}개)`
                : '주간 시간표'}
            </Text>
            <ActionButton
              label={fullDay ? '활동 시간대 (07~22시)' : '24시간 전체'}
              selected={fullDay}
              onPress={() => setFullDay((v) => !v)}
            />
          </View>
          {view === 'day' && dayEvents.length + dayTasks.length === 0 && (
            <Text className="text-xs text-muted-foreground">선택한 날에 등록된 일정이 없어요.</Text>
          )}
          <CalendarTimeline
            days={view === 'week' ? days : [day]}
            events={events}
            tasks={tasks}
            compact={view === 'week'}
            fullDay={fullDay}
            onSelectTask={setCandidateTask}
          />
        </View>
      )}

      {!loading && !error && (view === 'week' || view === 'month') && (
        <DayScheduleCard
          day={day}
          events={dayEvents}
          tasks={dayTasks}
          onSelectTask={setCandidateTask}
        />
      )}
      {!loading && !error && view === 'list' && (
        <View className="gap-3">
          {days
            .map((d) => ({
              d,
              ev: eventsOnDay(events, d),
              tk: tasks.filter(
                (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === d,
              ),
            }))
            .filter((x) => x.ev.length > 0 || x.tk.length > 0).length === 0 ? (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-xs text-muted-foreground">이번 주에 등록된 일정이 없어요.</Text>
            </View>
          ) : (
            days
              .map((d) => ({
                d,
                ev: eventsOnDay(events, d),
                tk: tasks.filter(
                  (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === d,
                ),
              }))
              .filter((x) => x.ev.length > 0 || x.tk.length > 0)
              .map(({ d, ev, tk }) => (
                <DayScheduleCard
                  key={d}
                  day={d}
                  events={ev}
                  tasks={tk}
                  onSelectTask={setCandidateTask}
                />
              ))
          )}
        </View>
      )}

      <View className="gap-2.5 pt-1">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            시간을 잡을 할 일 ({unscheduled.length}개)
          </Text>
          {scheduled.length > 0 && (
            <ActionButton
              label={
                showScheduled ? '배정된 할 일 접기' : `배정된 할 일 ${scheduled.length}개 보기`
              }
              selected={showScheduled}
              onPress={() => setShowScheduled((v) => !v)}
            />
          )}
        </View>
        {!loading && !error && unscheduled.length === 0 && (
          <View className="rounded-xl border border-border bg-card p-4">
            <Text className="text-xs text-muted-foreground">
              시간을 배정할 할 일이 모두 정리되었어요.
            </Text>
          </View>
        )}
        {[...unscheduled, ...(showScheduled ? scheduled : [])].map((task) => {
          const { cleanTitle, tags } = splitTitleAndTags(task.title);
          const meta = task.startAt
            ? `배정됨 (${dayKey(task.startAt)} ${timeLabel(task.startAt)})`
            : task.dueAt
              ? `마감 ${dayKey(task.dueAt)} ${timeLabel(task.dueAt)}`
              : '마감 없음';
          return (
            <View
              key={task.id}
              className="flex-row flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-card p-4"
            >
              <View className="flex-1 gap-1">
                <Text className="text-base font-bold text-foreground">{cleanTitle}</Text>
                <Text className="text-xs text-muted-foreground">
                  {meta}, {task.status === 'confirmed' ? '확인됨' : '확인 전 제안'}
                </Text>
                <TagChips tags={tags} />
              </View>
              {task.status === 'suggested' ? (
                <ActionButton
                  label="할 일 확인"
                  onPress={() =>
                    void confirmTask(task.id).catch((e: Error) => setMessage(e.message))
                  }
                />
              ) : (
                <ActionButton
                  label={task.startAt ? '시간 다시 잡기' : '시간 후보 보기'}
                  onPress={() => setCandidateTask(task)}
                />
              )}
            </View>
          );
        })}
      </View>

      {!!message && (
        <Text accessibilityLiveRegion="polite" className="text-sm text-foreground">
          {message}
        </Text>
      )}
      {candidateTask && (
        <TimeCandidates
          task={candidateTask}
          day={day}
          onClose={() => setCandidateTask(undefined)}
        />
      )}
      {showHashtags && (
        <HashtagGraphSheet events={events} tasks={tasks} onClose={() => setShowHashtags(false)} />
      )}
    </ScrollView>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {tags.map((tag) => (
        <View key={tag} className="rounded-sm bg-muted px-2 py-0.5">
          <Text className="text-[11px] font-semibold text-muted-foreground">{tag}</Text>
        </View>
      ))}
    </View>
  );
}

function DayScheduleCard({
  day,
  events,
  tasks,
  onSelectTask,
}: {
  day: string;
  events: CalendarEvent[];
  tasks: Card[];
  onSelectTask: (t: Card) => void;
}) {
  return (
    <View className="gap-2.5 rounded-xl border border-border bg-card p-4">
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        {DayLabel(day)} 일정 ({events.length + tasks.length}개)
      </Text>
      {events.length + tasks.length === 0 && (
        <Text className="text-xs text-muted-foreground">등록된 일정이 없어요.</Text>
      )}
      {events.map((ev) => {
        const { cleanTitle, tags } = splitTitleAndTags(ev.title);
        return (
          <View
            key={ev.id}
            className="flex-row items-center gap-3 rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft px-3 py-2.5"
          >
            <Text className="w-24 text-xs font-bold text-muted-foreground">
              {ev.allDay ? '종일' : `${timeLabel(ev.startAt)} ~ ${timeLabel(ev.endAt)}`}
            </Text>
            <View className="flex-1 gap-1">
              <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
              <TagChips tags={tags} />
            </View>
            <View className="rounded-sm bg-card px-2 py-0.5">
              <Text className="text-[11px] font-bold text-cal-1">캘린더</Text>
            </View>
          </View>
        );
      })}
      {tasks.map((task) => {
        const { cleanTitle, tags } = splitTitleAndTags(task.title);
        const range = `${timeLabel(task.startAt!)} ~ ${timeLabel(task.endAt!)}`;
        return (
          <Pressable
            key={task.id}
            accessibilityRole="button"
            accessibilityLabel={`${cleanTitle}, ${range}, 눌러서 시간 다시 잡기`}
            onPress={() => onSelectTask(task)}
            className="flex-row items-center gap-3 rounded-md border-l-[3px] border-l-task bg-task-soft px-3 py-2.5"
          >
            <Text className="w-24 text-xs font-bold text-muted-foreground">{range}</Text>
            <View className="flex-1 gap-1">
              <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
              <TagChips tags={tags} />
            </View>
            <View className="rounded-sm bg-card px-2 py-0.5">
              <Text className="text-[11px] font-bold text-task">할 일</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
