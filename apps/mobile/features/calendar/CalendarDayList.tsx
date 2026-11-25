import type { CalendarEvent, Card } from '@noteapp/shared';
import {
  DaySectionTitle,
  EventBlock,
  RailCard,
  TaskCheckRow,
  Text,
  type Account,
} from '@noteapp/ui';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import { dayKey, splitTitleAndTags, timeLabel } from './model';

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

function resolveEventAccount(calendarId?: string): Account {
  return calendarId === '노트 일정' ? 2 : 1;
}

function resolveCalendarLabel(calendarId?: string): string {
  if (!calendarId || calendarId === 'demo') return '회사';
  if (calendarId === '노트 일정') return '개인';
  return calendarId;
}

/** 달력 아래 그날 목록(일정, 할 일, 끝낸 일, 미배정 할 일). 상자 대신 구분선과 색 블록을 써요. */
export function CalendarDayList({
  day,
  today,
  events,
  dayTasks,
  unscheduledTasks,
  checkedTaskIds,
  onToggleTaskCheck,
  onOpenDaySheet,
  onSelectTask,
  onPressTag,
  onJumpToday,
  onOpenExecution,
}: {
  day: string;
  today: string;
  events: readonly CalendarEvent[];
  dayTasks: readonly Card[];
  unscheduledTasks: readonly Card[];
  checkedTaskIds: ReadonlySet<string>;
  onToggleTaskCheck: (task: Card) => void;
  onOpenDaySheet: (day: string, initialHour?: number, initialTab?: 'agenda' | 'add') => void;
  onSelectTask: (task: Card) => void;
  onPressTag: (tag: string) => void;
  onJumpToday: () => void;
  onOpenExecution: () => void;
}) {
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  const weekdayName = WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  const monthNum = Number(day.slice(5, 7));
  const dateNum = Number(day.slice(8, 10));

  const { suggestedDayTasks, openTasks, doneTasks } = useMemo(() => {
    const suggested: Card[] = [];
    const open: Card[] = [];
    const done: Card[] = [];
    for (const task of dayTasks) {
      if (task.status === 'suggested') {
        suggested.push(task);
      } else if (checkedTaskIds.has(task.id)) {
        done.push(task);
      } else {
        open.push(task);
      }
    }
    return { suggestedDayTasks: suggested, openTasks: open, doneTasks: done };
  }, [checkedTaskIds, dayTasks]);

  const scheduleCount = events.length + suggestedDayTasks.length;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-2.5 px-4 pb-28 pt-3">
      <View className="flex-row items-baseline justify-between gap-2">
        <View className="flex-row items-baseline gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
            {monthNum}월 {dateNum}일
          </Text>
          <Text className="text-[13px] text-muted-foreground">{weekdayName}요일</Text>
        </View>
        <View className="flex-row items-center gap-3">
          {day !== today ? (
            <Pressable onPress={onJumpToday} hitSlop={8} accessibilityRole="button">
              <Text className="text-[13px] font-bold text-primary">오늘</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onOpenDaySheet(day, undefined, 'agenda')}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text className="text-[13px] font-semibold text-muted-foreground">상세</Text>
          </Pressable>
        </View>
      </View>

      <DaySectionTitle
        label="일정"
        count={scheduleCount}
        action="추가"
        onAction={() => onOpenDaySheet(day, undefined, 'add')}
      />

      {scheduleCount === 0 ? (
        <Text className="py-1 text-xs text-muted-foreground">등록된 일정이 없어요.</Text>
      ) : (
        <View className="gap-2">
          {events.map((ev) => {
            const { cleanTitle } = splitTitleAndTags(ev.title);
            const timeRange = ev.allDay
              ? '종일'
              : `${timeLabel(ev.startAt)} ~ ${timeLabel(ev.endAt)}`;
            const metaText = `${timeRange}, ${resolveCalendarLabel(ev.calendarId)}`;
            return (
              <View key={ev.id}>
                <Pressable accessibilityRole="button" onPress={() => onOpenDaySheet(day)}>
                  <EventBlock
                    account={resolveEventAccount(ev.calendarId)}
                    title={cleanTitle}
                    meta={metaText}
                  />
                </Pressable>
                <HiddenTagDisclosure
                  itemId={ev.id}
                  title={ev.title}
                  compact
                  onPressTag={onPressTag}
                />
              </View>
            );
          })}
          {suggestedDayTasks.map((task) => {
            const { cleanTitle } = splitTitleAndTags(task.title);
            const timeRange = task.startAt
              ? task.endAt
                ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                : timeLabel(task.startAt)
              : '시간 미정';
            return (
              <View key={task.id}>
                <Pressable accessibilityRole="button" onPress={() => onSelectTask(task)}>
                  <EventBlock title={cleanTitle} meta={`${timeRange}, 아직 저장 안 됨`} />
                </Pressable>
                <HiddenTagDisclosure
                  itemId={task.id}
                  title={task.title}
                  compact
                  onPressTag={onPressTag}
                />
              </View>
            );
          })}
        </View>
      )}

      <DaySectionTitle
        label="할 일"
        count={openTasks.length}
        action="저녁에 한 번에 확인"
        onAction={onOpenExecution}
      />

      {openTasks.length === 0 && doneTasks.length === 0 ? (
        <Text className="py-1 text-xs text-muted-foreground">이 날에 잡힌 할 일이 없어요.</Text>
      ) : openTasks.length === 0 ? (
        <Text className="py-1 text-xs text-muted-foreground">남은 할 일이 없어요.</Text>
      ) : (
        <View className="gap-2">
          {openTasks.map((task) => {
            const { cleanTitle } = splitTitleAndTags(task.title);
            const metaText = task.startAt
              ? task.endAt
                ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                : `${timeLabel(task.startAt)} 로 잡음`
              : '메모에서 만든 카드';
            return (
              <View key={task.id}>
                <TaskCheckRow
                  title={cleanTitle}
                  meta={metaText}
                  onToggle={() => onToggleTaskCheck(task)}
                  onPress={() => onSelectTask(task)}
                />
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

      {doneTasks.length > 0 ? (
        <>
          <DaySectionTitle label="끝낸 일" count={doneTasks.length} />
          <View className="gap-2">
            {doneTasks.map((task) => {
              const { cleanTitle } = splitTitleAndTags(task.title);
              const metaText = task.startAt
                ? task.endAt
                  ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                  : `${timeLabel(task.startAt)} 로 잡음`
                : '메모에서 만든 카드';
              return (
                <TaskCheckRow
                  key={task.id}
                  title={cleanTitle}
                  meta={metaText}
                  status="done"
                  onToggle={() => onToggleTaskCheck(task)}
                  onPress={() => onSelectTask(task)}
                />
              );
            })}
          </View>
        </>
      ) : null}

      {unscheduledTasks.length > 0 ? (
        <View className="pt-1">
          <DaySectionTitle
            label="시간 안 잡은 할 일"
            count={unscheduledTasks.length}
            action={showUnscheduled ? '접기' : '펼치기'}
            onAction={() => setShowUnscheduled((prev) => !prev)}
          />
          {showUnscheduled ? (
            <View className="mt-1">
              {unscheduledTasks.map((task, index) => {
                const { cleanTitle } = splitTitleAndTags(task.title);
                const dueText = task.dueAt
                  ? `마감 ${dayKey(task.dueAt).slice(5)} ${timeLabel(task.dueAt)}`
                  : task.status === 'suggested'
                    ? '확인 대기'
                    : '시간 미정';
                return (
                  <View key={task.id}>
                    {index > 0 ? <View className="h-px bg-border" /> : null}
                    <RailCard
                      type="task"
                      title={cleanTitle}
                      meta={dueText}
                      right={
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => onSelectTask(task)}
                          hitSlop={8}
                        >
                          <Text className="text-[13px] font-bold text-primary">시간 잡기</Text>
                        </Pressable>
                      }
                    />
                    <View className="pb-2">
                      <HiddenTagDisclosure
                        itemId={task.id}
                        title={task.title}
                        editable
                        compact
                        onPressTag={onPressTag}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
