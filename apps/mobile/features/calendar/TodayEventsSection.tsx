import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { loadCalendar, refreshCalendar, useCalendar } from './data';
import { dayKey, eventsOnDay, splitTitleAndTags, timeLabel } from './model';

export function TodayEventsSection() {
  const { events, tasks, loading, error } = useCalendar();
  useFocusEffect(
    useCallback(() => {
      void refreshCalendar();
    }, []),
  );
  const today = dayKey(new Date());
  const daily = eventsOnDay(events, today);
  const scheduled = tasks.filter(
    (t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === today,
  );

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-foreground">오늘 일정</Text>
        <Text className="text-xs text-muted-foreground">{today} (서울 시간)</Text>
      </View>

      {loading ? (
        <Text className="text-xs text-muted-foreground">불러오는 중</Text>
      ) : error ? (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="text-sm text-destructive">
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadCalendar()}
            className="self-start rounded-lg border border-border bg-card px-3 py-2"
          >
            <Text className="text-xs font-semibold text-foreground">다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-1.5">
          {!daily.length && !scheduled.length && (
            <Text className="text-sm text-muted-foreground">오늘은 등록된 일정이 없어요.</Text>
          )}
          {daily.map((ev) => (
            <View key={ev.id} className="flex-row items-center gap-2">
              <Text className="text-xs font-bold text-cal-1">캘린더</Text>
              <Text className="flex-1 text-sm text-foreground">
                {ev.allDay ? '종일' : timeLabel(ev.startAt)}{' '}
                {splitTitleAndTags(ev.title).cleanTitle}
              </Text>
            </View>
          ))}
          {scheduled.map((task) => (
            <View key={task.id} className="flex-row items-center gap-2">
              <Text className="text-xs font-bold text-task">할 일</Text>
              <Text className="flex-1 text-sm text-foreground">
                {timeLabel(task.startAt!)} {splitTitleAndTags(task.title).cleanTitle}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/calendar')}
        className="items-center rounded-lg border border-border bg-card px-4 py-2.5"
      >
        <Text className="text-sm font-semibold text-foreground">캘린더 열기</Text>
      </Pressable>
    </View>
  );
}
