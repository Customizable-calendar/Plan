import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { loadCalendar, useCalendar } from './data';
import { CalendarButton, useCalendarTheme } from './design';
import { dayKey, eventsOnDay, timeLabel } from './model';

export function TodayEventsSection() {
  const { events, tasks, loading, error } = useCalendar();
  const { styles } = useCalendarTheme();
  const today = dayKey(new Date());
  const daily = eventsOnDay(events, today);
  const scheduled = tasks.filter((task) => task.startAt && dayKey(task.startAt) === today);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>오늘 일정</Text>
      <Text style={styles.muted}>{today} · 서울 시간</Text>
      {loading ? (
        <Text style={styles.muted}>불러오는 중…</Text>
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
          <CalendarButton label="다시 시도" onPress={() => void loadCalendar()} />
        </>
      ) : (
        <>
          {!daily.length && !scheduled.length && (
            <Text style={styles.text}>오늘은 등록된 일정이 없어요.</Text>
          )}
          {daily.map((event) => (
            <Text key={event.id} style={styles.text}>
              {event.allDay ? '종일' : timeLabel(event.startAt)} · {event.title}
            </Text>
          ))}
          {scheduled.map((task) => (
            <Text key={task.id} style={styles.text}>
              {timeLabel(task.startAt!)} · {task.title}
            </Text>
          ))}
        </>
      )}
      <CalendarButton label="캘린더 열기" onPress={() => router.push('/calendar')} />
    </View>
  );
}
