import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { loadCalendar, useCalendar } from './data';
import { dayKey, eventsOnDay, timeLabel } from './model';

// 홈 오늘 일정 자리(schedule). 디자인 시스템 홈의 ScheduleRow 모양을 따라요.
// 줄을 누르면 수행 확인 시트, 「전체 보기」는 캘린더 화면으로 가요.

interface Row {
  id: string;
  time: string;
  title: string;
  source: string;
  external: boolean;
}

function ScheduleRow({ row }: { row: Row }) {
  return (
    <Pressable
      onPress={() => router.push('/execution')}
      accessibilityRole="button"
      className="flex-row items-center gap-4 rounded-lg border border-border bg-card p-4"
    >
      <Text className="w-12 text-[15px] font-bold text-foreground">{row.time}</Text>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-foreground">{row.title}</Text>
        <Text className={row.external ? 'text-xs text-cal-1' : 'text-xs text-muted-foreground'}>
          {row.source}
        </Text>
      </View>
    </Pressable>
  );
}

export function HomeSchedule() {
  const { events, tasks, loading, error } = useCalendar();
  const today = dayKey(new Date());
  const rows: Row[] = [
    ...eventsOnDay(events, today).map((e) => ({
      id: e.id,
      time: e.allDay ? '종일' : timeLabel(e.startAt),
      title: e.title,
      source: 'Google 캘린더',
      external: true,
    })),
    ...tasks
      .filter((t) => t.startAt && dayKey(t.startAt) === today)
      .map((t) => ({
        id: t.id,
        time: timeLabel(t.startAt!),
        title: t.title,
        source: '노트에서 찾은 일정',
        external: false,
      })),
  ].sort((a, b) =>
    (a.time === '종일' ? '' : a.time).localeCompare(b.time === '종일' ? '' : b.time),
  ); // 종일 일정이 맨 위, 나머지는 시간순

  return (
    <View className="gap-2.5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[13px] font-semibold text-muted-foreground">오늘 일정</Text>
        <Pressable onPress={() => router.push('/calendar')} accessibilityRole="link" hitSlop={8}>
          <Text className="text-[13px] font-semibold text-primary">전체 보기</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text className="text-sm text-muted-foreground">불러오는 중</Text>
      ) : error ? (
        <Pressable onPress={() => void loadCalendar()} accessibilityRole="button">
          <Text className="text-sm text-destructive">{error} 눌러서 다시 시도</Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <View className="rounded-lg border border-dashed border-border p-4">
          <Text className="text-sm text-muted-foreground">오늘은 등록된 일정이 없어요.</Text>
        </View>
      ) : (
        rows.map((row) => <ScheduleRow key={row.id} row={row} />)
      )}
    </View>
  );
}
