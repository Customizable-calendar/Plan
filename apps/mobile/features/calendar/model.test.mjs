import assert from 'node:assert/strict';
import test from 'node:test';

import { dayKey, eventsOnDay, overlaps, shiftDay, suggestSlots, weekDays } from './model.ts';

test('서울 날짜는 UTC 자정 경계와 달라요', () => {
  assert.equal(dayKey('2026-10-26T15:00:00Z'), '2026-10-27');
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29');
});
test('일요일도 월요일부터 시작하는 7일에 포함돼요', () => {
  assert.deepEqual(weekDays('2026-10-25'), [
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
});
test('맞닿은 일정은 충돌하지 않아요', () => {
  assert.equal(
    overlaps('2026-10-27T00:00Z', '2026-10-27T01:00Z', '2026-10-27T01:00Z', '2026-10-27T02:00Z'),
    false,
  );
});
test('여러 날 일정과 종료 시각의 배타성을 반영해요', () => {
  const events = [{ startAt: '2026-10-26T14:00Z', endAt: '2026-10-27T15:00Z' }];
  assert.equal(eventsOnDay(events, '2026-10-27').length, 1);
  assert.equal(eventsOnDay(events, '2026-10-28').length, 0);
});
test('후보 3개는 서로 겹치지 않고 UTC로 반환돼요', () => {
  const slots = suggestSlots('2026-10-27', [], []);
  assert.equal(slots.length, 3);
  assert.equal(slots[0].startAt, '2026-10-27T00:00:00.000Z');
  assert.equal(slots[2].endAt, '2026-10-27T03:00:00.000Z');
});
test('일정과 저장된 할 일, 마감에 막힌 후보를 제외해요', () => {
  const events = [{ startAt: '2026-10-27T00:00Z', endAt: '2026-10-27T01:00Z' }];
  const tasks = [{ startAt: '2026-10-27T01:00Z', endAt: '2026-10-27T02:00Z' }];
  const slots = suggestSlots('2026-10-27', events, tasks, '2026-10-27T03:00Z');
  assert.equal(slots.length, 1);
  assert.equal(slots[0].startAt, '2026-10-27T02:00:00.000Z');
});
test('종일 바쁘거나 마감이 지난 날에는 후보가 없어요', () => {
  assert.equal(
    suggestSlots(
      '2026-10-27',
      [{ startAt: '2026-10-26T15:00Z', endAt: '2026-10-27T15:00Z', allDay: true }],
      [],
    ).length,
    0,
  );
  assert.equal(suggestSlots('2026-11-07', [], [], '2026-10-27T06:00Z').length, 0);
});
