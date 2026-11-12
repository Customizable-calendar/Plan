import type { Card, Note } from '@noteapp/shared';

import { extractByRules } from './extract';
import { markSpokenBreaks, tidySpokenTitle } from './spoken';
import { fromLocalFrame, toLocalFrame } from './zone';

// 캘린더 빠른 입력처럼 한 줄 일정 입력에는 파서를 바로 써요.
export { parseEvent, toRRule, toSegments, ko } from './rules';
export type { Assumption, ParsedEvent, ParseOptions, Recurrence, Span, Segment } from './rules';
export { cardHints, splitPieces } from './extract';
export { markSpokenBreaks, tidySpokenTitle } from './spoken';

export interface ExtractOptions {
  /** "내일", "다음 주" 같은 표현을 계산할 기준 시각 */
  now: Date;
  /** IANA 시간대, 예: Asia/Seoul */
  timezone: string;
  /**
   * 받아쓴 말(회의록)이면 true. 마침표가 없어도 말끝으로 나누고, 제목의 말꼬리를 다듬고,
   * 오늘 전의 일정·마감은 빼요("지난주에 했던"처럼 지난 이야기라서).
   */
  spoken?: boolean;
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
  const ctx = { now: options.now, timezone: options.timezone };
  if (!options.spoken) return extractByRules(note, ctx);

  // 글자 수를 바꾸지 않고 줄만 나눠서 span은 받아쓴 글 그대로 맞아요.
  const cards = extractByRules({ ...note, text: markSpokenBreaks(note.text) }, ctx);
  const today = startOfLocalDay(options.now, options.timezone);
  return cards
    .filter((c) => {
      const when = c.startAt ?? c.dueAt;
      return !when || new Date(when).getTime() >= today;
    })
    .map((c) => (c.type === 'person' ? c : { ...c, title: tidySpokenTitle(c.title) }));
}

function startOfLocalDay(now: Date, timezone: string): number {
  const local = toLocalFrame(now, timezone);
  local.setHours(0, 0, 0, 0);
  return fromLocalFrame(local, timezone).getTime();
}
