import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCorpusFrequency,
  extractAutoHashtags,
  normalizeHashtag,
  stripInlineHashtags,
} from './autoTags.ts';
import {
  buildUnigramIndex,
  computeLexicalSimilarity,
  computeSemanticLinks,
  cosineSimilarity,
  parseSafetensorsHeader,
  poolQuantizedRows,
  tokenizeUnigram,
} from './embeddingMath.ts';
import {
  buildHashtagEdges,
  buildHashtagGraph,
  computeHopDistances,
  extractHashtags,
  layoutHashtagGraph,
} from './hashtags.ts';
import {
  busyHoursOnDay,
  dayKey,
  eventsOnDay,
  groupEventsByDay,
  MAX_EVENT_TITLE_LENGTH,
  overlaps,
  shiftDay,
  splitTitleAndTags,
  suggestSlots as calculateSlots,
  suggestSlotsAcrossDays,
  validateCalendarEventInput,
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
  assert.deepEqual(
    grouped.get('2026-10-26')?.map((e) => e.id),
    ['multi'],
  );
  assert.deepEqual(
    grouped.get('2026-10-27')?.map((e) => e.id),
    ['multi', 'late'],
  );
  assert.deepEqual(grouped.get('2026-10-28'), []);
  for (const day of days) {
    assert.deepEqual(grouped.get(day), eventsOnDay(events, day));
  }
});

test('stripInlineHashtags는 본문과 정규화된 태그를 분리해요', () => {
  const res = stripInlineHashtags('팀 스탠드업 미팅 #회의 #React_Native #회의');
  assert.equal(res.cleanTitle, '팀 스탠드업 미팅');
  assert.deepEqual(res.tags, ['#회의', '#react_native']);
  assert.equal(normalizeHashtag('  ##Sprint_Plan  '), '#sprint_plan');
  assert.equal(normalizeHashtag('123'), '');
});

test('extractAutoHashtags는 조사 분리·보호어·불용어 제거·복합어 결합으로 자동 추출해요', () => {
  const meetingTags = extractAutoHashtags('주간 회의에서 스터디와 회고 정리');
  assert(meetingTags.includes('#회의'), `expected #회의 in ${meetingTags}`);
  assert(meetingTags.includes('#스터디'), `expected #스터디 in ${meetingTags}`);
  assert(meetingTags.includes('#회고'), `expected #회고 in ${meetingTags}`);
  assert(!meetingTags.includes('#회'));

  const runTags = extractAutoHashtags('한강 저녁 5km 러닝 및 스트레칭');
  assert(!runTags.includes('#5km'));
  assert(!runTags.includes('#저녁'));
  assert(runTags.includes('#러닝') || runTags.includes('#운동'));

  const devTags = extractAutoHashtags('PR 코드 리뷰 및 React Native UI 수정', { maxTags: 5 });
  assert(devTags.includes('#코드리뷰'), `expected #코드리뷰 in ${devTags}`);
  assert(devTags.includes('#react_native'), `expected #react_native in ${devTags}`);
  assert(!devTags.includes('#코드'));
  assert(!devTags.includes('#react'));

  const corpusFreq = buildCorpusFrequency([
    '아키텍처 세미나 준비',
    '아키텍처 문서 초안',
    '아키텍처 점검',
  ]);
  const boostedTags = extractAutoHashtags('시스템 아키텍처 발표', {
    preferredTags: ['#세미나'],
    corpusFreq,
  });
  assert(boostedTags.includes('#아키텍처'));
});

test('buildHashtagGraph는 # 기호가 없는 제목에서도 item.tags로 노드와 간선을 만들어요', () => {
  const graph = buildHashtagGraph([
    { id: '1', title: '백엔드 설계', tags: ['#개발', '#백엔드'] },
    { id: '2', title: 'API 리뷰', tags: ['#백엔드', '#코드리뷰'] },
  ]);
  const backend = graph.find((node) => node.tag === '#백엔드');
  assert(backend);
  assert.equal(backend.items.length, 2);
  assert.equal(backend.links.get('#개발'), 1);
  assert.equal(backend.links.get('#코드리뷰'), 1);
});

test('suggestSlotsAcrossDays와 busyHoursOnDay는 여러 날 빈 시간과 08~21시 점유 현황을 계산해요', () => {
  // 2026-10-27 11:30Z == 20:30 KST (오늘 21시까지 30분만 남아 60분 슬롯은 내일로 넘어가요)
  const now = Date.parse('2026-10-27T11:30:00Z');
  const events = [
    {
      startAt: '2026-10-28T01:00:00Z', // 10:00 KST
      endAt: '2026-10-28T02:00:00Z', // 11:00 KST
    },
  ];
  const tasks = [
    {
      id: 't-1',
      status: 'confirmed',
      startAt: '2026-10-28T06:00:00Z', // 15:00 KST
      endAt: '2026-10-28T07:00:00Z', // 16:00 KST
    },
  ];

  const multiSlots = suggestSlotsAcrossDays(['2026-10-27', '2026-10-28'], events, tasks, {
    now,
    durationMinutes: 60,
    limit: 3,
  });
  assert(multiSlots.length > 0);
  assert.equal(dayKey(multiSlots[0].startAt), '2026-10-28');

  const hours = busyHoursOnDay('2026-10-28', events, tasks);
  assert.equal(hours.length, 14);
  const hour10 = hours.find((h) => h.hour === 10);
  const hour15 = hours.find((h) => h.hour === 15);
  const hour12 = hours.find((h) => h.hour === 12);
  assert.deepEqual(hour10, { hour: 10, busy: true, eventCount: 1, taskCount: 0 });
  assert.deepEqual(hour15, { hour: 15, busy: true, eventCount: 0, taskCount: 1 });
  assert.deepEqual(hour12, { hour: 12, busy: false, eventCount: 0, taskCount: 0 });

  const excludingTask = busyHoursOnDay('2026-10-28', events, tasks, { excludeTaskId: 't-1' });
  assert.deepEqual(
    excludingTask.find((h) => h.hour === 15),
    {
      hour: 15,
      busy: false,
      eventCount: 0,
      taskCount: 0,
    },
  );
});

test('extractAutoHashtags는 1~5단계 강도에 따라 추출 개수를 점진적으로 조절해요', () => {
  const sample = '주간 백엔드 API 코드 리뷰 및 배포 점검';
  const level1 = extractAutoHashtags(sample, { level: 1 });
  const level3 = extractAutoHashtags(sample, { level: 3 });
  const level5 = extractAutoHashtags(sample, { level: 5 });

  assert.equal(level1.length, 1);
  assert(level1.length <= level3.length, `${level1.length} <= ${level3.length}`);
  assert(level3.length <= level5.length, `${level3.length} <= ${level5.length}`);
  assert(level5.length >= 4, `expected richer tags at level 5, got ${level5}`);
});

test('suggestSlotsAcrossDays는 다른 일정의 해시태그 일치도와 유사 시간대를 우선 추천해요', () => {
  const now = Date.parse('2026-10-27T23:00:00Z'); // 2026-10-28 08:00 KST
  const events = [
    {
      id: 'ev-run',
      title: '한강 조깅',
      startAt: '2026-10-27T10:00:00Z', // 19:00 KST
      endAt: '2026-10-27T11:00:00Z', // 20:00 KST
    },
    {
      id: 'ev-api',
      title: 'API 설계 미팅',
      startAt: '2026-10-27T01:00:00Z', // 10:00 KST
      endAt: '2026-10-27T02:00:00Z', // 11:00 KST
    },
  ];
  const itemTagsById = new Map([
    ['ev-run', ['#러닝', '#운동']],
    ['ev-api', ['#백엔드', '#회의']],
  ]);

  const workoutSlots = suggestSlotsAcrossDays(['2026-10-28'], events, [], {
    now,
    durationMinutes: 60,
    targetTitle: '컨디션 회복 운동하기',
    targetTags: ['#러닝', '#운동'],
    itemTagsById,
    limit: 3,
  });
  assert(workoutSlots.length > 0);
  const workoutHourKst = new Date(Date.parse(workoutSlots[0].startAt) + 9 * 3600000).getUTCHours();
  assert(
    workoutHourKst >= 18 && workoutHourKst <= 21,
    `expected evening slot matching 19시 #러닝/#운동, got ${workoutHourKst}시 (${workoutSlots[0].reason})`,
  );
  assert(
    workoutSlots[0].matchedTags?.includes('#운동') ||
      workoutSlots[0].matchedTags?.includes('#러닝'),
  );

  const backendSlots = suggestSlotsAcrossDays(['2026-10-28'], events, [], {
    now,
    durationMinutes: 60,
    targetTitle: 'API 리뷰 반영',
    targetTags: ['#백엔드', '#회의'],
    itemTagsById,
    limit: 3,
  });
  assert(backendSlots.length > 0);
  const backendHourKst = new Date(Date.parse(backendSlots[0].startAt) + 9 * 3600000).getUTCHours();
  assert(
    backendHourKst >= 9 && backendHourKst <= 11,
    `expected morning slot matching 10시 #백엔드/#회의, got ${backendHourKst}시 (${backendSlots[0].reason})`,
  );
});

test('suggestSlotsAcrossDays는 제목의 시간 단서(예: 저녁)를 우선 반영해요', () => {
  const now = Date.parse('2026-10-27T23:00:00Z'); // 2026-10-28 08:00 KST
  const slots = suggestSlotsAcrossDays(['2026-10-28'], [], [], {
    now,
    durationMinutes: 60,
    targetTitle: '저녁 독서 정리',
    limit: 3,
  });
  assert(slots.length > 0);
  const topHourKst = new Date(Date.parse(slots[0].startAt) + 9 * 3600000).getUTCHours();
  assert(
    topHourKst >= 18,
    `expected evening slot >= 18시, got ${topHourKst}시 (${slots[0].reason})`,
  );
  assert(slots[0].reason.includes('저녁'));
});

test('validateCalendarEventInput은 DB 제약 조건(제목 1~200자, 종료 >= 시작)을 검증해요', () => {
  assert.equal(MAX_EVENT_TITLE_LENGTH, 200);
  const startAt = '2026-10-28T01:00:00Z';
  const endAt = '2026-10-28T02:00:00Z';

  assert.equal(validateCalendarEventInput({ title: '  주간 회의  ', startAt, endAt }), '주간 회의');
  const exact200 = '가'.repeat(200);
  assert.equal(validateCalendarEventInput({ title: exact200, startAt, endAt }), exact200);

  // calendar_events 테이블 check (end_at >= start_at) 기준과 동일하게 같아도 허용해요.
  assert.equal(
    validateCalendarEventInput({ title: '마일스톤', startAt, endAt: startAt }),
    '마일스톤',
  );

  assert.throws(() => validateCalendarEventInput({ title: '   ', startAt, endAt }));
  assert.throws(() => validateCalendarEventInput({ title: '가'.repeat(201), startAt, endAt }));
  assert.throws(() => validateCalendarEventInput({ title: '회의', startAt: 'invalid', endAt }));
  assert.throws(() =>
    validateCalendarEventInput({
      title: '역전 일정',
      startAt: '2026-10-28T03:00:00Z',
      endAt: '2026-10-28T02:00:00Z',
    }),
  );
});

test('parseSafetensorsHeader와 Unigram 토크나이저는 INT8 정적 임베딩 행을 역양자화해요', () => {
  const headerJson = JSON.stringify({
    weights: { dtype: 'F32', shape: [6], data_offsets: [0, 24] },
    embeddings: { dtype: 'I8', shape: [6, 4], data_offsets: [24, 48] },
  });
  const headerBytes = new TextEncoder().encode(headerJson);
  const buf = new ArrayBuffer(8 + headerBytes.byteLength);
  new DataView(buf).setUint32(0, headerBytes.byteLength, true);
  new DataView(buf).setUint32(4, 0, true);
  new Uint8Array(buf, 8).set(headerBytes);

  const layout = parseSafetensorsHeader(buf);
  assert.equal(layout.vocabSize, 6);
  assert.equal(layout.dim, 4);
  assert.equal(layout.weightsOffset, 8 + headerBytes.byteLength);
  assert.equal(layout.embeddingsOffset, 8 + headerBytes.byteLength + 24);

  const tokIndex = buildUnigramIndex(
    JSON.stringify({
      model: {
        vocab: [
          ['[PAD]', -10],
          ['[UNK]', -10],
          ['[CLS]', -10],
          ['[SEP]', -10],
          ['▁', -5],
          ['▁과제', -2.1],
          ['▁숙제', -2.3],
          ['제출', -2.5],
        ],
      },
    }),
  );

  // 공백 마커(id <= 4)는 건너뛰고 유효 서브워드 ID만 반환해요.
  assert.deepEqual(tokenizeUnigram('과제 제출', tokIndex), [5, 7]);
  assert.deepEqual(tokenizeUnigram('숙제', tokIndex), [6]);

  const vecA = poolQuantizedRows(
    [
      { scale: 0.5, values: new Int8Array([20, 0, 10, 0]) },
      { scale: 0.25, values: new Int8Array([0, 40, 0, 0]) },
    ],
    4,
  );
  const vecB = poolQuantizedRows([{ scale: 1.0, values: new Int8Array([10, 10, 5, 0]) }], 4);
  const vecOther = poolQuantizedRows([{ scale: 1.0, values: new Int8Array([0, 0, 0, 20]) }], 4);

  assert(cosineSimilarity(vecA, vecB) > 0.99);
  assert.equal(Math.round(cosineSimilarity(vecA, vecOther) * 1000), 0);
});

test('computeLexicalSimilarity와 computeSemanticLinks는 비슷한 태그(#과제, #숙제, #레포트)를 연결해요', () => {
  assert(computeLexicalSimilarity('#과제', '#숙제') >= 0.8);
  assert(computeLexicalSimilarity('#레포트', '#리포트') >= 0.6);
  assert(computeLexicalSimilarity('#과제', '#러닝') < 0.3);

  const vectors = new Map([
    ['#치과', new Float32Array([1, 0, 0, 0])],
    ['#병원', new Float32Array([0.92, 0.39, 0, 0])],
    ['#발표', new Float32Array([0, 0, 1, 0])],
  ]);

  const links = computeSemanticLinks(
    [
      { id: 'e1', title: '운영체제 과제 제출', tags: ['#운영체제', '#과제'] },
      { id: 'e2', title: '영어 숙제 마무리', tags: ['#영어', '#숙제'] },
      { id: 'e3', title: '데이터베이스 레포트 작성', tags: ['#데이터베이스', '#레포트'] },
      { id: 'e4', title: '아침 한강 러닝', tags: ['#한강', '#러닝'] },
      { id: 'e5', title: '치과 검진', tags: ['#치과'] },
      { id: 'e6', title: '병원 방문', tags: ['#병원'] },
      { id: 'e7', title: '중간 발표 준비', tags: ['#발표'] },
    ],
    { vectors, maxNeighborsPerNode: 2 },
  );

  const hasPair = (a, b) =>
    links.some((l) => (l.source === a && l.target === b) || (l.source === b && l.target === a));
  assert(hasPair('#과제', '#숙제'));
  assert(hasPair('#과제', '#레포트'));
  assert(hasPair('#치과', '#병원'));
  assert(!hasPair('#과제', '#러닝'));
});

test('buildHashtagGraph와 layoutHashtagGraph는 동시 출현이 없어도 의미 유사 간선과 군집을 반영해요', () => {
  const items = [
    { id: '1', title: '운영체제 과제 제출', tags: ['#과제'] },
    { id: '2', title: '영어 숙제 마무리', tags: ['#숙제'] },
    { id: '3', title: '한강 러닝', tags: ['#러닝'] },
  ];
  const semanticLinks = computeSemanticLinks(items);
  const graph = buildHashtagGraph(items, { semanticLinks });

  const hwNode = graph.find((n) => n.tag === '#과제');
  const assignNode = graph.find((n) => n.tag === '#숙제');
  const runNode = graph.find((n) => n.tag === '#러닝');
  assert(hwNode && assignNode && runNode);
  assert.equal(hwNode.links.size, 0);
  assert(hwNode.semanticLinks?.has('#숙제'));
  assert.equal(hwNode.cluster, assignNode.cluster);

  const hops = computeHopDistances(graph, '#과제');
  assert.equal(hops.get('#숙제'), 1);
  assert.equal(hops.get('#러닝'), Infinity);

  const edges = buildHashtagEdges(graph);
  const semanticEdge = edges.find(
    (e) =>
      e.kind === 'semantic' &&
      ((e.source === '#과제' && e.target === '#숙제') ||
        (e.source === '#숙제' && e.target === '#과제')),
  );
  assert(semanticEdge);

  const layout = layoutHashtagGraph(graph, {
    width: 480,
    height: 360,
    focusTag: '#과제',
    backboneOnly: true,
  });
  assert(layout.edges.some((e) => e.kind === 'semantic' && e.backbone));
});

test('computeSemanticLinks는 태그 수가 많아지면 임계치와 이웃 수(최대 2개)를 자동으로 조여요', () => {
  const items = [
    { id: 's1', title: '운영체제 과제 제출', tags: ['#과제'] },
    { id: 's2', title: '영어 숙제 마무리', tags: ['#숙제'] },
    { id: 's3', title: '실험 레포트 작성', tags: ['#레포트'] },
    { id: 's4', title: '중간 보고서 제출', tags: ['#보고서'] },
    { id: 's5', title: '주간 assignment 정리', tags: ['#assignment'] },
  ];
  for (let i = 0; i < 65; i++) {
    items.push({
      id: `n-${i}`,
      title: `고유 주제 ${i}`,
      tags: [`#토픽_${i}`],
    });
  }

  const links = computeSemanticLinks(items);
  const assignmentNeighbors = links.filter((l) => l.source === '#과제' || l.target === '#과제');
  assert(assignmentNeighbors.length >= 1 && assignmentNeighbors.length <= 2);
  assert(links.every((l) => l.similarity >= 0.74));
});
