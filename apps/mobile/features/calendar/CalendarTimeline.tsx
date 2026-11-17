import type { CalendarEvent } from '@noteapp/shared';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dayKey, shiftDay, splitTitleAndTags, timeLabel, TIMEZONE } from './model';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

const HOUR_MINUTE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function currentSeoulHour(): number {
  const parts = HOUR_MINUTE_FORMATTER.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour + minute / 60;
}

export function CalendarTimeline({
  days,
  events,
  compact = false,
  fullDay = false,
  onSelectSlot,
}: {
  days: string[];
  events: CalendarEvent[];
  compact?: boolean;
  fullDay?: boolean;
  onSelectSlot?: (day: string, hour?: number) => void;
}) {
  const today = dayKey(new Date());
  const nowHour = currentSeoulHour();

  const { allDayColumns, hasAllDay, columns, earliest, latest } = useMemo(() => {
    const dayBounds = days.map((day) => ({
      day,
      startMs: Date.parse(`${day}T00:00:00+09:00`),
      endMs: Date.parse(`${shiftDay(day, 1)}T00:00:00+09:00`),
    }));

    const parsedAllDay = events
      .filter((e) => e.allDay)
      .map((e) => ({
        id: e.id,
        cleanTitle: splitTitleAndTags(e.title).cleanTitle,
        startMs: Date.parse(e.startAt),
        endMs: Date.parse(e.endAt),
      }));

    const nextAllDayColumns = dayBounds.map(({ day, startMs, endMs }) => ({
      day,
      items: parsedAllDay.filter((e) => e.startMs < endMs && e.endMs > startMs),
    }));

    const parsedTimed = events
      .filter((e) => !e.allDay)
      .map((e) => ({
        id: e.id,
        cleanTitle: splitTitleAndTags(e.title).cleanTitle,
        range: `${timeLabel(e.startAt)} ~ ${timeLabel(e.endAt)}`,
        startMs: Date.parse(e.startAt),
        endMs: Date.parse(e.endAt),
      }));

    const nextColumns = dayBounds.map(({ day, startMs, endMs }) => {
      const items = parsedTimed
        .filter((e) => e.startMs < endMs && e.endMs > startMs)
        .map((e) => ({
          ...e,
          from: Math.max(0, (e.startMs - startMs) / 3600000),
          to: Math.min(24, (e.endMs - startMs) / 3600000),
        }))
        .sort((a, b) => a.from - b.from);

      const ends: number[] = [];
      const positioned = items.map((item) => {
        let lane = ends.findIndex((e) => e <= item.from);
        if (lane < 0) lane = ends.length;
        ends[lane] = item.to;
        return { ...item, lane };
      });
      return { day, positioned, laneCount: Math.max(1, ends.length) };
    });

    const allStarts = nextColumns.flatMap((c) => c.positioned.map((item) => item.from));
    const allEnds = nextColumns.flatMap((c) => c.positioned.map((item) => item.to));

    return {
      allDayColumns: nextAllDayColumns,
      hasAllDay: nextAllDayColumns.some((col) => col.items.length > 0),
      columns: nextColumns,
      earliest: allStarts.length ? Math.min(7, ...allStarts) : 7,
      latest: allEnds.length ? Math.max(22, ...allEnds) : 22,
    };
  }, [days, events]);

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
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${day} 일정 및 할 일 열기`}
                onPress={() => onSelectSlot?.(day)}
                className="flex-1 items-center rounded-md py-1 active:bg-muted"
              >
                <Text
                  className={`text-xs font-semibold ${day === today ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                >
                  {Number(day.slice(-2))} {weekday}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {hasAllDay && (
        <View className="flex-row items-center border-b border-border pb-1.5">
          <Text className={`text-[11px] text-muted-foreground ${timeColClass}`}>종일</Text>
          {allDayColumns.map(({ day, items }) => (
            <View key={day} className="flex-1 gap-1 px-0.5">
              {items.map((ev) => (
                <Pressable
                  key={ev.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${ev.cleanTitle}, 종일 일정 열기`}
                  onPress={() => onSelectSlot?.(day)}
                  className="rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft px-2 py-1"
                >
                  <Text numberOfLines={1} className="text-xs font-semibold text-foreground">
                    {ev.cleanTitle}
                  </Text>
                </Pressable>
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
        {columns.map(({ day, positioned, laneCount }) => {
          const showNow = day === today && nowHour >= from && nowHour <= to;

          return (
            <View
              key={day}
              className={`relative flex-1 border-b border-l border-border ${day === today && showHeaders ? 'bg-primary-soft/30' : ''}`}
              style={{ height: (to - from) * height }}
            >
              {Array.from({ length: to - from }, (_, hr) => {
                const hour = from + hr;
                const hourText = String(hour).padStart(2, '0');
                return (
                  <Pressable
                    key={hr}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${hourText}시 일정 및 할 일 열기`}
                    onPress={() => onSelectSlot?.(day, hour)}
                    className="absolute left-0 right-0 border-t border-border active:bg-primary-soft/40"
                    style={{ top: hr * height, height }}
                  />
                );
              })}

              {positioned.map((event) => {
                const blockHeight = Math.max(
                  compact ? 22 : 28,
                  (event.to - event.from) * height - 4,
                );
                const posStyle = {
                  top: (event.from - from) * height + 2,
                  height: blockHeight,
                  left: `${(event.lane / laneCount) * 100}%` as const,
                  width: `${100 / laneCount}%` as const,
                };
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.cleanTitle}, ${event.range}, 눌러서 상세 보기`}
                    onPress={() => onSelectSlot?.(day)}
                    className={`absolute overflow-hidden rounded-md border-l-[3px] border-l-cal-1 bg-cal-1-soft ${compact ? 'px-1 py-0.5' : 'px-2.5 py-1'}`}
                    style={posStyle}
                  >
                    <Text
                      numberOfLines={compact ? 2 : 1}
                      className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-bold text-foreground`}
                    >
                      {event.cleanTitle}
                    </Text>
                    {!compact && blockHeight >= 38 && (
                      <Text numberOfLines={1} className="text-[11px] text-cal-1">
                        {event.range} (캘린더)
                      </Text>
                    )}
                  </Pressable>
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
