import type { Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { TimeCandidates } from './TimeCandidates';
import { CalendarTimeline } from './CalendarTimeline';
import { confirmTask, loadCalendar, useCalendar } from './data';
import { CalendarButton, useCalendarTheme } from './design';
import { dayKey, eventsOnDay, shiftDay, shiftMonth, timeLabel, weekDays } from './model';

export function CalendarScreen() {
  const { events, tasks, loading, error } = useCalendar();
  const { colors, styles } = useCalendarTheme();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [candidateTask, setCandidateTask] = useState<Card>();
  const [message, setMessage] = useState('');
  const [dailyListHeight, setDailyListHeight] = useState<number>();
  const days = weekDays(day);
  const month = day.slice(0, 7);
  const monthStart = month + '-01';
  const nextMonth = shiftMonth(monthStart, 1);
  const gridStart = weekDays(monthStart)[0];
  const gridDays =
    view === 'month'
      ? Array.from({ length: 6 }, (_, week) => weekDays(shiftDay(gridStart, week * 7))).filter(
          (week) => week[0] < nextMonth,
        )
      : [days];
  const shownDays = view === 'week' ? days : [day];
  const period = { day: '날', week: '주', month: '달' }[view];

  function movePeriod(direction: number) {
    setDay(
      view === 'month'
        ? shiftMonth(monthStart, direction)
        : shiftDay(day, direction * (view === 'week' ? 7 : 1)),
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>나의 시간</Text>
      <Text accessibilityRole="header" style={styles.title}>
        캘린더
      </Text>
      <View style={styles.row}>
        <CalendarButton label="일 보기" selected={view === 'day'} onPress={() => setView('day')} />
        <CalendarButton
          label="주 보기"
          selected={view === 'week'}
          onPress={() => setView('week')}
        />
        <CalendarButton
          label="월 보기"
          selected={view === 'month'}
          onPress={() => setView('month')}
        />
      </View>
      <View style={styles.row}>
        <CalendarButton label={'이전 ' + period} onPress={() => movePeriod(-1)} />
        <Text style={styles.heading}>{(view === 'month' ? month : day).replaceAll('-', '. ')}</Text>
        <CalendarButton label={'다음 ' + period} onPress={() => movePeriod(1)} />
      </View>
      {gridDays.map((week, row) => (
        <View key={week[0]} style={{ flexDirection: 'row', gap: 3 }}>
          {week.map((date, i) => {
            const count =
              eventsOnDay(events, date).length +
              tasks.filter((task) => task.startAt && dayKey(task.startAt) === date).length;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${date} ${count}개 일정`}
                accessibilityState={{ selected: date === day }}
                onPress={() => setDay(date)}
                style={{
                  flex: 1,
                  minHeight: view === 'month' && row > 0 ? 44 : 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  opacity: view === 'month' && !date.startsWith(month) ? 0.55 : 1,
                  backgroundColor: date === day ? colors.primary : colors.muted,
                }}
              >
                {(view !== 'month' || row === 0) && (
                  <Text
                    style={{
                      color: date === day ? colors.primaryForeground : colors.mutedForeground,
                    }}
                  >
                    {['월', '화', '수', '목', '금', '토', '일'][i]}
                  </Text>
                )}
                <Text
                  style={{
                    fontWeight: '700',
                    color: date === day ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {Number(date.slice(-2))}
                </Text>
                <Text style={{ color: date === day ? colors.primaryForeground : colors.cal1 }}>
                  {count ? '•' : ' '}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {loading && (
        <ActivityIndicator accessibilityLabel="일정 불러오는 중" color={colors.primary} />
      )}
      {!!error && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
          <CalendarButton label="다시 시도" onPress={() => void loadCalendar()} />
        </View>
      )}
      {!loading && !error && view === 'day' && (
        <CalendarTimeline days={[day]} events={events} tasks={tasks} />
      )}
      {!loading && !error && (
        <ScrollView
          key={view === 'week' ? 'week' : day}
          accessibilityLabel={view === 'week' ? '주간 일정 목록' : '일정 목록'}
          nestedScrollEnabled
          scrollEnabled={view !== 'week'}
          onContentSizeChange={(_, height) => {
            if (view !== 'week') setDailyListHeight(height);
          }}
          style={
            view !== 'week'
              ? { maxHeight: dailyListHeight && Math.max(96, dailyListHeight / 2) }
              : undefined
          }
          contentContainerStyle={{ gap: 12 }}
        >
          {shownDays.map((date) => {
            const daily = eventsOnDay(events, date);
            const scheduled = tasks.filter((task) => task.startAt && dayKey(task.startAt) === date);
            return (
              <View key={date} style={[styles.card, view === 'week' && { padding: 12, gap: 6 }]}>
                <Text accessibilityRole="header" style={styles.heading}>
                  {date} · {daily.length + scheduled.length}개 일정
                </Text>
                {!daily.length && !scheduled.length && (
                  <Text style={styles.muted}>등록된 일정이 없어요.</Text>
                )}
                {daily.map((event) => (
                  <View key={event.id} style={view === 'week' ? styles.row : styles.event}>
                    <Text style={view === 'week' ? styles.text : styles.heading}>
                      {event.title}
                    </Text>
                    {view !== 'week' && (
                      <Text style={styles.muted}>
                        {event.allDay
                          ? '종일'
                          : `${timeLabel(event.startAt)}–${timeLabel(event.endAt)}`}{' '}
                        · {event.calendarId}
                      </Text>
                    )}
                  </View>
                ))}
                {scheduled.map((task) => (
                  <View
                    key={task.id}
                    style={
                      view === 'week'
                        ? styles.row
                        : [
                            styles.event,
                            {
                              borderLeftColor: colors.primary,
                              backgroundColor: colors.primarySoft,
                            },
                          ]
                    }
                  >
                    <Text style={view === 'week' ? styles.text : styles.heading}>{task.title}</Text>
                    {view !== 'week' && (
                      <Text style={styles.muted}>
                        {timeLabel(task.startAt!)}–{timeLabel(task.endAt!)} · 시간 잡은 할 일
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
      <Text accessibilityRole="header" style={styles.heading}>
        시간을 잡을 할 일
      </Text>
      {!loading && !error && !tasks.length && (
        <Text style={styles.muted}>시간을 잡을 할 일이 없어요.</Text>
      )}
      {tasks.map((task) => (
        <View key={task.id} style={styles.card}>
          <Text style={styles.heading}>{task.title}</Text>
          <Text style={styles.muted}>
            {task.dueAt ? `마감 ${dayKey(task.dueAt)} ${timeLabel(task.dueAt)}` : '마감 없음'} ·{' '}
            {task.status === 'confirmed' ? '확인됨' : '확인 전 제안'}
          </Text>
          {task.status === 'suggested' ? (
            <CalendarButton
              label="할 일 확인"
              onPress={() => {
                void confirmTask(task.id).catch((error: Error) => setMessage(error.message));
              }}
            />
          ) : (
            <CalendarButton
              label={task.startAt ? '시간 다시 잡기' : '시간 후보 보기'}
              onPress={() => setCandidateTask(task)}
            />
          )}
        </View>
      ))}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message}
        </Text>
      )}
      <CalendarButton
        label="오늘 한 일 확인"
        selected
        onPress={() => router.push({ pathname: '/execution', params: { date: day } })}
      />
      {candidateTask && (
        <TimeCandidates
          task={candidateTask}
          day={day}
          onClose={() => setCandidateTask(undefined)}
        />
      )}
    </ScrollView>
  );
}
