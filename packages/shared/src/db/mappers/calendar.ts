// calendar_events 행(snake_case) ↔ 앱 CalendarEvent(camelCase). (담당: C)
import type { CalendarEvent } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type CalendarEventRow = Tables<'calendar_events'>;
export type CalendarEventInsert = TablesInsert<'calendar_events'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toCalendarEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    title: row.title,
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
    allDay: row.all_day,
    timezone: row.timezone,
    source: row.source,
  };
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toCalendarEventInsert(event: CalendarEvent): CalendarEventInsert {
  return {
    id: event.id,
    calendar_id: event.calendarId,
    title: event.title,
    start_at: event.startAt,
    end_at: event.endAt,
    all_day: event.allDay,
    timezone: event.timezone,
    source: event.source,
  };
}
