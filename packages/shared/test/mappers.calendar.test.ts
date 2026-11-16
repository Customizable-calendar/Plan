import { describe, expect, it } from 'vitest';

import {
  type CalendarEventRow,
  toCalendarEvent,
  toCalendarEventInsert,
} from '../src/db/mappers/calendar';
import { fixtures } from '../src';

function asRow(insert: ReturnType<typeof toCalendarEventInsert>): CalendarEventRow {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    all_day: false,
    source: 'google',
    ...insert,
    // DB는 시각을 +00:00 형태로 돌려줘요.
    start_at: insert.start_at.replace('Z', '+00:00'),
    end_at: insert.end_at.replace('Z', '+00:00'),
  } as CalendarEventRow;
}

describe('calendar mapper', () => {
  it('예시 일정이 DB를 다녀와도 같다', () => {
    for (const event of fixtures.events) {
      const back = toCalendarEvent(asRow(toCalendarEventInsert(event)));
      expect(back).toEqual(event);
    }
  });
});
