import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dayKey,
  eventsOnDay,
  overlaps,
  shiftDay,
  suggestSlots as calculateSlots,
  weekDays,
} from './model.ts';

const suggestSlots = (...args) =>
  calculateSlots(args[0], args[1], args[2], args[3], Date.parse('2026-10-01T00:00Z'));

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

test('현재 이후 15분 경계부터 제안하고 지난 날은 제외해요', () => {
  const now = Date.parse('2026-10-27T00:07:00Z');
  const slots = calculateSlots('2026-10-27', [], [], undefined, now);
  assert.equal(slots[0].startAt, '2026-10-27T00:15:00.000Z');
  assert.deepEqual(calculateSlots('2026-10-26', [], [], undefined, now), []);
});

test('짧은 빈 구간을 우선하고 중첩 일정은 하나의 바쁜 구간으로 처리해요', () => {
  const events = [
    { startAt: '2026-10-27T01:00Z', endAt: '2026-10-27T02:00Z' },
    { startAt: '2026-10-27T01:30Z', endAt: '2026-10-27T03:00Z' },
    { startAt: '2026-10-27T04:00Z', endAt: '2026-10-27T07:00Z' },
  ];
  const slots = suggestSlots('2026-10-27', events, []);
  assert.deepEqual(
    slots.map((slot) => slot.startAt),
    ['2026-10-27T00:00:00.000Z', '2026-10-27T03:00:00.000Z', '2026-10-27T07:00:00.000Z'],
  );
  for (const slot of slots)
    assert(
      events.every((event) => !overlaps(slot.startAt, slot.endAt, event.startAt, event.endAt)),
    );
});

test('30분 격자에 없던 빈 시간도 찾고 더 긴 빈 구간보다 우선해요', () => {
  const events = [
    { startAt: '2026-10-27T00:00Z', endAt: '2026-10-27T00:10Z' },
    { startAt: '2026-10-27T01:20Z', endAt: '2026-10-27T02:00Z' },
  ];
  assert.equal(suggestSlots('2026-10-27', events, [])[0].startAt, '2026-10-27T00:15:00.000Z');
});

test('잘못된 마감과 역전 일정에서는 안전하게 후보를 비워요', () => {
  assert.deepEqual(suggestSlots('2026-10-27', [], [], 'invalid'), []);
  assert.deepEqual(
    suggestSlots('2026-10-27', [{ startAt: '2026-10-27T02:00Z', endAt: '2026-10-27T01:00Z' }], []),
    [],
  );
});
