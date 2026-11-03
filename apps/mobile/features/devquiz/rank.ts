import { type Member, members } from '@/features/devlog';

import type { QuizResult } from './store';

// 빌보드 순위. 이번 주는 점수, 누적은 평균 점수(같으면 많이 푼 사람, 그다음 먼저 푼 사람).

export const TOP_TITLE = '공부하면서 개발도 열심히 한 사람';
export const BOTTOM_TITLE = 'AI 딸깍하고 공부는 안 한 사람';

export interface Rank {
  member: Member;
  rank: number;
  score: number;
  /** 누적일 때 푼 주 수 */
  weeks: number;
  title?: string;
}

export function rankBoard(
  results: QuizResult[],
  week: string | 'all',
): { ranks: Rank[]; missing: Member[] } {
  const rows = members.flatMap((member) => {
    const mine = results.filter(
      (r) => r.author === member.role && (week === 'all' || r.week === week),
    );
    if (mine.length === 0) return [];
    const score = Math.round(mine.reduce((s, r) => s + r.score, 0) / mine.length);
    const first = Math.min(...mine.map((r) => Date.parse(r.createdAt)));
    return [{ member, score, weeks: mine.length, first }];
  });
  rows.sort((a, b) => b.score - a.score || b.weeks - a.weeks || a.first - b.first);

  const ranks: Rank[] = [];
  rows.forEach((row, i) => {
    const prev = ranks[i - 1];
    const rank = prev && prev.score === row.score && prev.weeks === row.weeks ? prev.rank : i + 1;
    ranks.push({ member: row.member, rank, score: row.score, weeks: row.weeks });
  });
  // 두 명 이상 풀었을 때만 1등·꼴등 칭호를 붙여요. 공동이면 같이 받아요.
  if (ranks.length >= 2) {
    const last = ranks[ranks.length - 1].rank;
    for (const r of ranks) {
      if (r.rank === 1) r.title = TOP_TITLE;
      else if (r.rank === last) r.title = BOTTOM_TITLE;
    }
  }
  const missing = members.filter((m) => !rows.some((r) => r.member.role === m.role));
  return { ranks, missing };
}
