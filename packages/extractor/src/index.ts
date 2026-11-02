import type { Card, Note } from '@noteapp/shared';

import { extractByRules } from './extract';

// 캘린더 빠른 입력처럼 한 줄 일정 입력에는 파서를 바로 써요.
export { parseEvent, toRRule, toSegments, ko } from './rules';
export type { Assumption, ParsedEvent, ParseOptions, Recurrence, Span, Segment } from './rules';
export { cardHints, splitPieces } from './extract';

export interface ExtractOptions {
  /** "내일", "다음 주" 같은 표현을 계산할 기준 시각 */
  now: Date;
  /** IANA 시간대, 예: Asia/Seoul */
  timezone: string;
  /** 규칙으로 못 잡은 부분만 AI에 보낼 때 쓰는 함수 (M3) */
  ai?: (text: string) => Promise<Card[]>;
}

/**
 * 메모에서 카드 후보를 찾아요. 모두 status: 'suggested'예요.
 * 규칙(src/rules)으로 일정·할 일·사람·아이디어를 잡아요.
 * TODO(B, M3): 규칙으로 카드가 안 나온 조각만 options.ai로 보내기
 */
export async function extractCards(note: Note, options: ExtractOptions): Promise<Card[]> {
  if (note.text.trim() === '') return [];
  return extractByRules(note, { now: options.now, timezone: options.timezone });
}
