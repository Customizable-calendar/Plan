import { describe, expect, it } from 'vitest';

import { assignSpeakers, clockOf, timedLines, toSpeakerText, toSrt, toTimedText } from '../src';

describe('받아쓴 글을 시각 붙은 줄로', () => {
  it('덩어리 안 문장을 나누고 시간을 글자 수로 나눈다', () => {
    const lines = timedLines([
      { text: '회의 시작하겠습니다 오늘은 발표 준비예요', startMs: 0, endMs: 4000 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['회의 시작하겠습니다.', '오늘은 발표 준비예요.']);
    expect(lines[0]!.startMs).toBe(0);
    expect(lines[0]!.endMs).toBeGreaterThan(1500);
    expect(lines[0]!.endMs).toBeLessThan(2500);
    expect(lines[1]!.endMs).toBe(4000);
  });

  it('문장이 안 끝난 덩어리는 다음 덩어리와 붙인다', () => {
    const lines = timedLines([
      { text: '다음 주 화요일 오후 2시에', startMs: 0, endMs: 2000 },
      { text: '디자인 리뷰를 해요', startMs: 2100, endMs: 4000 },
    ]);
    expect(lines).toEqual([
      { text: '다음 주 화요일 오후 2시에 디자인 리뷰를 해요.', startMs: 0, endMs: 4000 },
    ]);
  });

  it('오래 쉬었으면 문장이 안 끝나도 나눈다', () => {
    const lines = timedLines([
      { text: '그러니까 이건', startMs: 0, endMs: 1000 },
      { text: '나중에 정해요', startMs: 3000, endMs: 4000 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['그러니까 이건', '나중에 정해요.']);
  });

  it('7초가 넘으면 나눈다', () => {
    const lines = timedLines([
      { text: '첫 번째 이야기를 하고 있고', startMs: 0, endMs: 5000 },
      { text: '두 번째 이야기를 이어서 하고', startMs: 5000, endMs: 10000 },
    ]);
    expect(lines).toHaveLength(2);
  });

  it('빈 글은 줄이 없다', () => {
    expect(timedLines([{ text: '  ', startMs: 0, endMs: 1000 }])).toEqual([]);
  });
});

describe('내보내기', () => {
  const lines = [
    { text: '회의를 시작할게요.', startMs: 5200, endMs: 7000 },
    { text: '질문 있나요?', startMs: 3_723_456, endMs: 3_723_600 },
  ];

  it('시각 붙은 글', () => {
    expect(toTimedText(lines)).toBe('[0:05] 회의를 시작할게요.\n[1:02:03] 질문 있나요?');
    expect(clockOf(63_000)).toBe('1:03');
  });

  it('SRT: 번호, 시각, 최소 0.5초', () => {
    expect(toSrt(lines)).toBe(
      '1\n00:00:05,200 --> 00:00:07,000\n회의를 시작할게요.\n\n' +
        '2\n01:02:03,456 --> 01:02:03,956\n질문 있나요?\n',
    );
  });
});

describe('화자 구분', () => {
  const segments = [
    { text: '회의 시작할게요', startMs: 0, endMs: 2000 },
    { text: '네 좋아요', startMs: 2200, endMs: 3000 },
    { text: '그럼 첫 안건부터 봐요', startMs: 3200, endMs: 5000 },
  ];
  const turns = [
    { startMs: 0, endMs: 2100, speaker: 3 },
    { startMs: 2100, endMs: 3100, speaker: 1 },
    { startMs: 3100, endMs: 5000, speaker: 3 },
  ];

  it('가장 오래 겹치는 사람을 붙이고 처음 말한 순서로 번호를 매긴다', () => {
    expect(assignSpeakers(segments, turns).map((s) => s.speaker)).toEqual([0, 1, 0]);
  });

  it('겹치는 사람이 없으면 제일 가까운 사람', () => {
    const far = [{ text: '음', startMs: 6000, endMs: 6500 }];
    expect(assignSpeakers(far, turns)[0]!.speaker).toBe(0);
  });

  it('구간이 없으면 그대로', () => {
    expect(assignSpeakers(segments, [])).toEqual(segments);
  });

  it('사람이 바뀌면 줄을 나누고 이름을 붙인다', () => {
    const lines = timedLines([
      { text: '다음 주 화요일에', startMs: 0, endMs: 1000, speaker: 0 },
      { text: '네 알겠어요', startMs: 1100, endMs: 2000, speaker: 1 },
    ]);
    expect(lines.map((l) => [l.text, l.speaker])).toEqual([
      ['다음 주 화요일에', 0],
      ['네 알겠어요.', 1],
    ]);
    expect(toTimedText(lines)).toBe('[0:00] 화자 1: 다음 주 화요일에\n[0:01] 화자 2: 네 알겠어요.');
    expect(toSrt(lines)).toContain('화자 2: 네 알겠어요.');
  });

  it('같은 사람이 이어 말하면 한 줄로', () => {
    const lines = [
      { text: '첫 문장이에요.', startMs: 0, endMs: 1000, speaker: 0 },
      { text: '둘째 문장이에요.', startMs: 1000, endMs: 2000, speaker: 0 },
      { text: '네.', startMs: 2000, endMs: 2500, speaker: 1 },
    ];
    expect(toSpeakerText(lines)).toBe('화자 1: 첫 문장이에요. 둘째 문장이에요.\n화자 2: 네.');
  });
});
