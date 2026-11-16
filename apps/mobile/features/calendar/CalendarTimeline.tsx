import type { CalendarEvent, Card } from '@noteapp/shared';
import { Pressable, Text, View } from 'react-native';

import {
  dayKey,
  eventsOnDay,
  overlaps,
  shiftDay,
  splitTitleAndTags,
  timeLabel,
  TIMEZONE,
} from './model';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function currentSeoulHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour + minute / 60;
}

export function CalendarTimeline({
  days,
  events,
  tasks,
  compact = false,
  fullDay = false,
  onSelectTask,
}: {
  days: string[];
  events: CalendarEvent[];
  tasks: Card[];
  compact?: boolean;
  fullDay?: boolean;
  onSelectTask?: (task: Card) => void;
}) {
  const today = dayKey(new Date());
  const nowHour = currentSeoulHour();
  const timedItems = [
    ...events
      .filter((e) => !e.allDay)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        taskCard: undefined as Card | undefined,
      })),
    ...tasks.flatMap((t) =>
      t.startAt && t.endAt && t.status !== 'dismissed'
        ? [{ id: t.id, title: t.title, startAt: t.startAt, endAt: t.endAt, taskCard: t }]
        : [],
    ),
  ];

  const allDayColumns = days.map((day) => eventsOnDay(events, day).filter((e) => e.allDay));
  const hasAllDay = allDayColumns.some((col) => col.length > 0);
  let earliest = 7;
  let latest = 22;

  const columns = days.map((day) => {
    const start = `${day}T00:00:00+09:00`;
    const end = `${shiftDay(day, 1)}T00:00:00+09:00`;
    return timedItems
      .filter((item) => overlaps(item.startAt, item.endAt, start, end))
      .map((item) => {
        const from = Math.max(0, (Date.parse(item.startAt) - Date.parse(start)) / 3600000);
        const to = Math.min(24, (Date.parse(item.endAt) - Date.parse(start)) / 3600000);
        if (from < earliest) earliest = from;
        if (to > latest) latest = to;
        return { ...item, from, to };
      })
      .sort((a, b) => a.from - b.from);
  });

  const from = fullDay ? 0 : Math.max(0, Math.min(7, Math.floor(earliest)));
  const to = fullDay ? 24 : Math.min(24, Math.max(22, Math.ceil(latest)));
  const height = compact ? 44 : 56;
  const showHeaders = days.length > 1;
  const timeColClass = compact ? 'w-9' : 'w-12';

  return (
    <View accessibilityLabel="시간표" className="gap-2 rounded-xl border border-border bg-card p-3">
      {showHeaders && (
        <View className="flex-row items-center">
          <View className={timeColClass} />
          {days.map((day) => {
            const weekday = WEEKDAY_KO[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
            return (
              <View key={day} className="flex-1 items-center py-1">
                <Text
                  className={`text-xs font-semibold ${day === today ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                >
                  {Number(day.slice(-2))} {weekday}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {hasAllDay && (
        <View className="flex-row items-center border-b border-border pb-1.5">
          <Text className={`text-[11px] text-muted-foreground ${timeColClass}`}>종일</Text>
          {allDayColumns.map((col, idx) => (
            <View key={days[idx]} className="flex-1 gap-1 px-0.5">
              {col.map((ev) => (
                <View
                  key={ev.id}
                  className="rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft px-2 py-1"
                >
                  <Text numberOfLines={1} className="text-xs font-semibold text-foreground">
                    {splitTitleAndTags(ev.title).cleanTitle}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <View className="flex-row py-1.5">
        <View className={timeColClass}>
          {Array.from({ length: to - from }, (_, i) => (
            <Text key={i} className="-mt-1.5 text-[11px] text-muted-foreground" style={{ height }}>
              {compact
                ? String(from + i).padStart(2, '0')
                : `${String(from + i).padStart(2, '0')}:00`}
            </Text>
          ))}
        </View>
        {columns.map((column, idx) => {
          const day = days[idx];
          const ends: number[] = [];
          const positioned = column.map((item) => {
            let lane = ends.findIndex((e) => e <= item.from);
            if (lane < 0) lane = ends.length;
            ends[lane] = item.to;
            return { ...item, lane };
          });
          const laneCount = Math.max(1, ends.length);
          const showNow = day === today && nowHour >= from && nowHour <= to;

          return (
            <View
              key={day}
              className={`relative flex-1 border-l border-border ${day === today && showHeaders ? 'bg-primary-soft/30' : ''}`}
              style={{ height: (to - from) * height }}
            >
              {Array.from({ length: to - from + 1 }, (_, hr) => (
                <View
                  key={hr}
                  className="absolute left-0 right-0 border-t border-border"
                  style={{ top: hr * height }}
                />
              ))}
              {positioned.map((item) => {
                const isTask = Boolean(item.taskCard);
                const { cleanTitle } = splitTitleAndTags(item.title);
                const blockHeight = Math.max(compact ? 22 : 28, (item.to - item.from) * height - 4);
                const range = `${timeLabel(item.startAt)} ~ ${timeLabel(item.endAt)}`;
                const posStyle = {
                  top: (item.from - from) * height + 2,
                  height: blockHeight,
                  left: `${(item.lane / laneCount) * 100}%` as const,
                  width: `${100 / laneCount}%` as const,
                };
                const cls = `absolute overflow-hidden rounded-md border-l-[3px] ${compact ? 'px-1 py-0.5' : 'px-2.5 py-1'} ${isTask ? 'border-l-task bg-task-soft' : 'border-l-cal-1 bg-cal-1-soft'}`;

                if (item.taskCard && onSelectTask) {
                  const taskCard = item.taskCard;
                  return (
                    <Pressable
                      key={`task:${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${cleanTitle}, ${range}, 눌러서 시간 바꾸기`}
                      onPress={() => onSelectTask(taskCard)}
                      className={cls}
                      style={posStyle}
                    >
                      <Text
                        numberOfLines={compact ? 2 : 1}
                        className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-bold text-foreground`}
                      >
                        {cleanTitle}
                      </Text>
                      {!compact && blockHeight >= 38 && (
                        <Text numberOfLines={1} className="text-[11px] font-semibold text-task">
                          {range} (할 일)
                        </Text>
                      )}
                    </Pressable>
                  );
                }
                return (
                  <View
                    key={(isTask ? 'task:' : 'event:') + item.id}
                    accessibilityLabel={`${cleanTitle}, ${range}`}
                    className={cls}
                    style={posStyle}
                  >
                    <Text
                      numberOfLines={compact ? 2 : 1}
                      className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-bold text-foreground`}
                    >
                      {cleanTitle}
                    </Text>
                    {!compact && blockHeight >= 38 && (
                      <Text numberOfLines={1} className="text-[11px] text-muted-foreground">
                        {range} (캘린더)
                      </Text>
                    )}
                  </View>
                );
              })}
              {showNow && (
                <View
                  pointerEvents="none"
                  className="absolute left-0 right-0 z-10 h-0.5 bg-destructive"
                  style={{ top: (nowHour - from) * height }}
                >
                  <View className="-left-1 -top-[3px] h-2 w-2 rounded-full bg-destructive" />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
