import type { CalendarEvent, Card } from '@noteapp/shared';
import { type ComponentRef, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useCalendarTheme } from './design';
import { overlaps, shiftDay, timeLabel } from './model';

export function CalendarTimeline({
  days,
  events,
  tasks,
}: {
  days: string[];
  events: CalendarEvent[];
  tasks: Card[];
}) {
  const { colors, styles } = useCalendarTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const didSetInitialHour = useRef(false);
  const items = [
    ...events.filter((event) => !event.allDay).map((event) => ({ ...event, task: false })),
    ...tasks.flatMap((task) =>
      task.startAt && task.endAt
        ? [{ id: task.id, title: task.title, startAt: task.startAt, endAt: task.endAt, task: true }]
        : [],
    ),
  ];
  const columns = days.map((day) => {
    const start = `${day}T00:00:00+09:00`;
    const end = `${shiftDay(day, 1)}T00:00:00+09:00`;
    return items
      .filter((item) => overlaps(item.startAt, item.endAt, start, end))
      .map((item) => ({
        ...item,
        from: Math.max(0, (Date.parse(item.startAt) - Date.parse(start)) / 3600000),
        to: Math.min(24, (Date.parse(item.endAt) - Date.parse(start)) / 3600000),
      }))
      .sort((a, b) => a.from - b.from);
  });
  const from = 0;
  const to = 24;
  const height = 64;
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        accessibilityLabel="24시간 시간표"
        nestedScrollEnabled
        ref={scrollRef}
        style={{ maxHeight: (32 + 9 * height) / 2 }}
        onContentSizeChange={() => {
          if (didSetInitialHour.current || !scrollRef.current) return;
          scrollRef.current.scrollTo({ y: 32 + 9 * height, animated: false });
          didSetInitialHour.current = true;
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 46, paddingTop: 32 }}>
            {Array.from({ length: to - from }, (_, i) => (
              <Text key={i} style={[styles.muted, { height }]}>
                {String(from + i).padStart(2, '0')}:00
              </Text>
            ))}
          </View>
          {columns.map((column, index) => {
            // 겹치는 블록은 별도 열에 놓아 제목과 시간을 가리지 않아요.
            const ends: number[] = [];
            const positioned = column.map((item) => {
              let lane = ends.findIndex((end) => end <= item.from);
              if (lane < 0) lane = ends.length;
              ends[lane] = item.to;
              return { ...item, lane };
            });
            return (
              <View key={days[index]} style={{ flex: 1 }}>
                <Text style={[styles.muted, { height: 32, textAlign: 'center' }]}>
                  {days[index].slice(5)}
                </Text>
                <View
                  style={{
                    height: (to - from) * height,
                    borderLeftWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {Array.from({ length: to - from + 1 }, (_, hour) => (
                    <View
                      key={hour}
                      style={{
                        position: 'absolute',
                        top: hour * height,
                        left: 0,
                        right: 0,
                        borderTopWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                  ))}
                  {positioned.map((item) => (
                    <View
                      key={(item.task ? 'task:' : 'event:') + item.id}
                      accessibilityLabel={`${item.title} ${timeLabel(item.startAt)}부터 ${timeLabel(item.endAt)}까지`}
                      style={{
                        position: 'absolute',
                        top: (item.from - from) * height + 2,
                        height: Math.max(20, (item.to - item.from) * height - 4),
                        left: `${(item.lane / ends.length) * 100}%`,
                        width: `${100 / ends.length}%`,
                        padding: 6,
                        borderRadius: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: item.task ? colors.primary : colors.cal1,
                        backgroundColor: item.task ? colors.primarySoft : colors.cal1Soft,
                        overflow: 'hidden',
                      }}
                    >
                      <Text
                        numberOfLines={2}
                        style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {timeLabel(item.startAt)}–{timeLabel(item.endAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
