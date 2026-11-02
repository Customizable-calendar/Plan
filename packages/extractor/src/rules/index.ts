// 한국어 자연어 날짜·일정 파서. Customizable-calendar/event-parser에서 옮겨 왔어요.
// 한 줄 입력 → ParsedEvent. 메모 전체를 카드로 바꾸는 건 ../index.ts의 extractCards예요.
import type { Field, Span } from './types';

export { parseEvent } from './parse';
export { toRRule } from './dates';
export { ko } from './lexicon/ko';
export type * from './types';

export interface Segment {
  text: string;
  field?: Field;
}

/** 입력창 하이라이트용: 원문을 인식된 구간/일반 구간으로 나눈다 */
export function toSegments(text: string, spans: Span[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start > pos) out.push({ text: text.slice(pos, s.start) });
    out.push({ text: text.slice(s.start, s.end), field: s.field });
    pos = s.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
