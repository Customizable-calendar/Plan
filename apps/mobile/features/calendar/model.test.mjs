import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHashtagEdges,
  buildHashtagGraph,
  computeHopDistances,
  extractHashtags,
  layoutHashtagGraph,
} from './hashtags.ts';
import {
  dayKey,
  eventsOnDay,
  groupEventsByDay,
  overlaps,
  shiftDay,
  splitTitleAndTags,
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

test('해시태그 추출은 소문자 정규화를 수행하고 잘못된 패턴을 무시해요', () => {
  assert.deepEqual(
    extractHashtags('주간 회의 #기획 #React_Native #인공지능 foo#ignored https://a.com/#frag #'),
    ['#기획', '#react_native', '#인공지능'],
  );
  assert.deepEqual(extractHashtags('태그가 없는 일정 #기획 #기획'), ['#기획']);
});

test('해시태그 그래프와 간선, 군집이 동시 출현 횟수를 반영해요', () => {
  const graph = buildHashtagGraph([
    { id: '1', title: 'A #기획 #개발' },
    { id: '2', title: 'B #기획 #개발 #디자인' },
    { id: '3', title: 'C #운동 #건강' },
  ]);
  const plan = graph.find((node) => node.tag === '#기획');
  assert(plan);
  assert.equal(plan.links.get('#개발'), 2);
  assert.equal(plan.links.get('#디자인'), 1);
  assert(graph.every((node) => node.cluster >= 0 && node.cluster < 6));

  const edges = buildHashtagEdges(graph);
  assert.equal(edges.length, 4);
  const planDev = edges.find(
    (edge) =>
      (edge.source === '#개발' && edge.target === '#기획') ||
      (edge.source === '#기획' && edge.target === '#개발'),
  );
  assert.equal(planDev?.weight, 2);
});

test('촌수 계산은 최단 거리와 고립 노드를 정확히 구분해요', () => {
  const graph = buildHashtagGraph([
    { id: '1', title: '1 #기획 #개발' },
    { id: '2', title: '2 #개발 #프론트엔드' },
    { id: '3', title: '3 #프론트엔드 #성능최적화' },
    { id: '4', title: '4 #운동' },
  ]);
  const hops = computeHopDistances(graph, '#기획');
  assert.equal(hops.get('#기획'), 0);
  assert.equal(hops.get('#개발'), 1);
  assert.equal(hops.get('#프론트엔드'), 2);
  assert.equal(hops.get('#성능최적화'), 3);
  assert.equal(hops.get('#운동'), Infinity);
});

test('신경망 힘 기반 배치는 모든 노드를 캔버스 안에 겹치지 않게 배치해요', () => {
  const graph = buildHashtagGraph([
    { id: '1', title: '1 #기획 #개발 #디자인' },
    { id: '2', title: '2 #개발 #프론트엔드 #성능최적화' },
    { id: '3', title: '3 #기획 #로드맵 #팀회의' },
    { id: '4', title: '4 #스터디 #알고리즘 #개발' },
    { id: '5', title: '5 #운동 #러닝 #건강' },
  ]);

  const width = 480;
  const height = 380;
  const full = layoutHashtagGraph(graph, { width, height, focusTag: '#개발' });
  assert.equal(full.nodes.length, graph.length);

  for (const node of full.nodes) {
    assert(Number.isFinite(node.x) && Number.isFinite(node.y));
    assert(node.x >= 0 && node.x <= width);
    assert(node.y >= 0 && node.y <= height);
  }

  for (let i = 0; i < full.nodes.length; i++) {
    for (let j = i + 1; j < full.nodes.length; j++) {
      const dist = Math.hypot(full.nodes[i].x - full.nodes[j].x, full.nodes[i].y - full.nodes[j].y);
      assert(dist > 8, `노드 ${full.nodes[i].tag}와 ${full.nodes[j].tag}가 겹쳤어요: ${dist}`);
    }
  }

  const oneHop = layoutHashtagGraph(graph, { width, height, focusTag: '#개발', maxHops: 1 });
  const oneHopTags = new Set(oneHop.nodes.map((node) => node.tag));
  assert(oneHop.nodes.every((node) => node.hop <= 1));
  assert(oneHop.edges.some((edge) => edge.active));
  assert(oneHop.edges.every((edge) => oneHopTags.has(edge.source) && oneHopTags.has(edge.target)));
  assert(!oneHopTags.has('#운동'));
});

test('핵심 연결만(backboneOnly) 필터는 고립 노드 없이 불필요한 배경 선을 줄여요', () => {
  const graph = buildHashtagGraph([
    { id: '1', title: '1 #a #b #c #d' },
    { id: '2', title: '2 #a #b' },
    { id: '3', title: '3 #b #c' },
    { id: '4', title: '4 #e #f' },
  ]);

  const full = layoutHashtagGraph(graph, {
    width: 600,
    height: 480,
    focusTag: '#e',
    backboneOnly: false,
  });
  const backbone = layoutHashtagGraph(graph, {
    width: 600,
    height: 480,
    focusTag: '#e',
    backboneOnly: true,
  });

  assert(backbone.edges.length < full.edges.length);
  assert(backbone.edges.every((edge) => edge.backbone));
  // 모든 연결된 노드(#a, #b, #c, #d, #e, #f)가 적어도 1개의 backbone 간선을 유지해요.
  for (const node of graph) {
    if (node.links.size > 0) {
      assert(
        backbone.edges.some((edge) => edge.source === node.tag || edge.target === node.tag),
        `${node.tag} 노드가 고립되었어요.`,
      );
    }
  }
});

test('splitTitleAndTags는 해시태그를 소문자 정규화해 분리하고 깔끔한 제목을 돌려줘요', () => {
  const parsed = splitTitleAndTags('주간 회의 #기획 #React_Native #기획');
  assert.equal(parsed.cleanTitle, '주간 회의');
  assert.deepEqual(parsed.tags, ['#기획', '#react_native']);
  const tagOnly = splitTitleAndTags('#회고');
  assert.equal(tagOnly.cleanTitle, '#회고');
  assert.deepEqual(tagOnly.tags, ['#회고']);
});

test('groupEventsByDay는 여러 날에 걸친 일정과 경계 배타성을 eventsOnDay와 동일하게 분류해요', () => {
  const events = [
    { id: 'late', startAt: '2026-10-27T05:00:00Z', endAt: '2026-10-27T06:00:00Z' },
    { id: 'multi', startAt: '2026-10-26T14:00:00Z', endAt: '2026-10-27T15:00:00Z' },
  ];
  const days = ['2026-10-26', '2026-10-27', '2026-10-28'];
  const grouped = groupEventsByDay(events, days);
  assert.deepEqual(grouped.get('2026-10-26')?.map((e) => e.id), ['multi']);
  assert.deepEqual(grouped.get('2026-10-27')?.map((e) => e.id), ['multi', 'late']);
  assert.deepEqual(grouped.get('2026-10-28'), []);
  for (const day of days) {
    assert.deepEqual(grouped.get(day), eventsOnDay(events, day));
  }
});
