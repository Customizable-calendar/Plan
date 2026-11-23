import { AgendaRow, DaySectionTitle, Text } from '@noteapp/ui';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { loadCalendar, refreshCalendar, useCalendar } from './data';
import { dayKey, eventsOnDay, splitTitleAndTags, timeLabel } from './model';

export function TodayEventsSection() {
  const { events, tasks, loading, error } = useCalendar();
  useFocusEffect(
    useCallback(() => {
      void refreshCalendar();
    }, []),
  );
  const [now] = useState(() => new Date());
  const today = dayKey(now);
  const nowMs = now.getTime();

  const rows = useMemo(
    () =>
      [
        ...eventsOnDay(events, today).map((ev) => ({
          id: ev.id,
          start: ev.allDay ? '종일' : timeLabel(ev.startAt),
          end: ev.allDay ? undefined : timeLabel(ev.endAt),
          title: splitTitleAndTags(ev.title).cleanTitle,
          meta: ev.calendarId === '노트 일정' ? '개인 캘린더' : 'Google 캘린더',
          tone: (ev.calendarId === '노트 일정' ? 'cal-2' : 'cal-1') as 'cal-1' | 'cal-2',
          past: !ev.allDay && new Date(ev.endAt).getTime() < nowMs,
        })),
        ...tasks
          .filter((t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === today)
          .map((t) => ({
            id: t.id,
            start: timeLabel(t.startAt!),
            end: t.endAt ? timeLabel(t.endAt) : undefined,
            title: splitTitleAndTags(t.title).cleanTitle,
            meta: t.status === 'suggested' ? '아직 저장 안 됨' : '할 일',
            tone: (t.status === 'suggested' ? 'ai' : 'cal-2') as 'ai' | 'cal-2',
            past: t.endAt ? new Date(t.endAt).getTime() < nowMs : false,
          })),
      ].sort((a, b) =>
        (a.start === '종일' ? '' : a.start).localeCompare(b.start === '종일' ? '' : b.start),
      ),
    [events, nowMs, tasks, today],
  );

  return (
    <View>
      <DaySectionTitle
        label="오늘 일정"
        count={rows.length}
        action="캘린더"
        onAction={() => router.push('/calendar')}
      />

      {loading ? (
        <Text className="py-3 text-sm text-muted-foreground">불러오는 중</Text>
      ) : error ? (
        <Pressable onPress={() => void loadCalendar()} accessibilityRole="button" className="py-3">
          <Text accessibilityRole="alert" className="text-sm text-destructive">
            {error} 눌러서 다시 시도
          </Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <Text className="py-4 text-sm text-muted-foreground">오늘은 등록된 일정이 없어요.</Text>
      ) : (
        rows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <View className="h-px bg-border" /> : null}
            <AgendaRow
              start={row.start}
              end={row.end}
              title={row.title}
              meta={row.meta}
              tone={row.tone}
              past={row.past}
            />
          </View>
        ))
      )}
    </View>
  );
}
