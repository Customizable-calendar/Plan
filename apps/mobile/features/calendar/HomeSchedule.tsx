import { AgendaRow, DaySectionTitle, Text } from '@noteapp/ui';
import { router, useFocusEffect } from 'expo-router';
import { MicIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { loadCalendar, refreshCalendar, useCalendar } from './data';
import { dayKey, eventsOnDay, splitTitleAndTags, timeLabel } from './model';

// 홈 오늘 일정 자리(schedule). 상자 없는 목록(AgendaRow)과 구분선으로 보여 줘요.
// 줄을 누르면 수행 확인 시트, 오른쪽 녹음 버튼은 받아쓰기, 「캘린더」는 캘린더 화면으로 가요.

interface Row {
  id: string;
  start: string;
  end?: string;
  title: string;
  meta: string;
  tone: 'cal-1' | 'cal-2' | 'ai';
  past: boolean;
}

export function HomeSchedule() {
  const { events, tasks, loading, error } = useCalendar();
  useFocusEffect(
    useCallback(() => {
      void refreshCalendar();
    }, []),
  );
  const [now] = useState(() => new Date());
  const today = dayKey(now);
  const nowMs = now.getTime();

  const rows = useMemo<Row[]>(
    () =>
      [
        ...eventsOnDay(events, today).map((e) => ({
          id: e.id,
          start: e.allDay ? '종일' : timeLabel(e.startAt),
          end: e.allDay ? undefined : timeLabel(e.endAt),
          title: splitTitleAndTags(e.title).cleanTitle,
          meta: 'Google 캘린더',
          tone: 'cal-1' as const,
          past: !e.allDay && new Date(e.endAt).getTime() < nowMs,
        })),
        ...tasks
          .filter((t) => t.status !== 'dismissed' && t.startAt && dayKey(t.startAt) === today)
          .map((t) => ({
            id: t.id,
            start: timeLabel(t.startAt!),
            end: t.endAt ? timeLabel(t.endAt) : undefined,
            title: splitTitleAndTags(t.title).cleanTitle,
            meta: t.status === 'suggested' ? '아직 저장 안 됨' : '노트에서 찾은 일정',
            tone: (t.status === 'suggested' ? 'ai' : 'cal-2') as 'ai' | 'cal-2',
            past: t.endAt ? new Date(t.endAt).getTime() < nowMs : false,
          })),
      ].sort((a, b) =>
        (a.start === '종일' ? '' : a.start).localeCompare(b.start === '종일' ? '' : b.start),
      ),
    [events, tasks, today, nowMs],
  );

  return (
    <View>
      <Pressable onPress={() => router.push('/calendar')} accessibilityRole="link">
        <DaySectionTitle label="일정" count={rows.length} action="캘린더" />
      </Pressable>
      {loading ? (
        <Text className="py-3 text-sm text-muted-foreground">불러오는 중</Text>
      ) : error ? (
        <Pressable onPress={() => void loadCalendar()} accessibilityRole="button" className="py-3">
          <Text className="text-sm text-destructive">{error} 눌러서 다시 시도</Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <Text className="py-4 text-sm text-muted-foreground">오늘은 등록된 일정이 없어요.</Text>
      ) : (
        rows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <View className="h-px bg-border" /> : null}
            <Pressable onPress={() => router.push('/execution')} accessibilityRole="button">
              <AgendaRow
                start={row.start}
                end={row.end}
                title={row.title}
                meta={row.meta}
                tone={row.tone}
                past={row.past}
                action={
                  row.past
                    ? undefined
                    : {
                        icon: MicIcon,
                        label: '이 일정 녹음하기',
                        onPress: () => router.push('/stt'),
                      }
                }
              />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
