import { describe, expect, it } from 'vitest';

import { extractCards, markSpokenBreaks, tidySpokenTitle } from '../src';

// 받아쓰기 결과처럼 마침표 없는 회의록
const meeting =
  '네 그럼 회의 시작하겠습니다 지난주에 얘기했던 로그인 화면은 준호가 거의 다 끝냈고요 ' +
  '다음 주 화요일 오후 2시에 디자인 리뷰를 하기로 했습니다 서현이가 그 전까지 시안을 공유해 주기로 했고 ' +
  '민성이는 금요일까지 편집기 버그를 고치기로 했어요 그리고 11월 20일에 중간 발표가 있으니까 ' +
  '발표 자료는 재민이가 18일까지 만들어 주세요 아 그리고 내일 저녁 7시에 팀 회식 있습니다';
const options = { now: new Date('2026-11-12T03:00:00Z'), timezone: 'Asia/Seoul', spoken: true };

describe('받아쓴 말에서 카드 찾기', () => {
  it('줄만 나누고 글자 수는 그대로다', () => {
    const marked = markSpokenBreaks(meeting);
    expect(marked.length).toBe(meeting.length);
    expect(marked.split('\n').length).toBeGreaterThan(5);
    // "거의 다 끝냈고요"의 "다"에서는 안 나눠요.
    expect(marked).toContain('거의 다 끝냈고요');
  });

  it('회의록에서 일정·할 일을 찾고 지난 일은 뺀다', async () => {
    const cards = await extractCards({ id: 'm', text: meeting, createdAt: '' }, options);
    const brief = cards.map((c) => [c.type, c.title, c.startAt ?? c.dueAt]);
    expect(brief).toEqual([
      ['event', '디자인 리뷰', '2026-11-17T05:00:00.000Z'],
      ['task', '민성이는 편집기 버그를 고치기', '2026-11-13T14:59:00.000Z'],
      ['event', '중간 발표', '2026-11-19T15:00:00.000Z'],
      ['task', '발표 자료는 재민이가 만들기', '2026-11-18T14:59:00.000Z'],
      ['event', '팀 회식', '2026-11-13T10:00:00.000Z'],
    ]);
    for (const c of cards) {
      const [s, e] = c.source.span;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(meeting.length);
      expect(c.status).toBe('suggested');
    }
  });

  it('spoken이 없으면 지금과 같다', async () => {
    const cards = await extractCards(
      { id: 'm', text: meeting, createdAt: '' },
      { ...options, spoken: false },
    );
    expect(cards.length).toBeLessThanOrEqual(1);
  });

  it('말꼬리와 군말을 지운다', () => {
    expect(tidySpokenTitle('아 그리고 팀 회식 있습니다')).toBe('팀 회식');
    expect(tidySpokenTitle('디자인 리뷰를 하기로 했습니다')).toBe('디자인 리뷰');
    expect(tidySpokenTitle('보고서 정리해 주세요')).toBe('보고서 정리하기');
    expect(tidySpokenTitle('네')).toBe('네');
  });
});
