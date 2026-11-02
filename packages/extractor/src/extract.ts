import type { Card, Note } from '@noteapp/shared';

import { parseEvent } from './rules';
import type { ParsedEvent } from './rules';
import { fromLocalFrame, toLocalFrame } from './zone';

// 메모 → 카드 후보. 메모를 문장 조각으로 자르고, 조각마다 파서를 돌려 카드로 바꿔요.
// 카드의 span은 항상 메모 원문 기준이에요.

export interface Piece {
  text: string;
  start: number;
  /** 빈 줄로 나뉜 문단 번호. "할 일" 제목은 같은 문단에만 이어져요. */
  para: number;
}

/** 줄바꿈, 문장 끝(. ! ? 。), 목록 기호(- • *)로 자르고 앞뒤 공백을 뺀 조각 */
export function splitPieces(text: string): Piece[] {
  const pieces: Piece[] = [];
  const breaks = [...text.matchAll(/\n[ \t]*\n/g)].map((m) => m.index!);
  // 숫자 사이 마침표(10.27, 2.5)는 문장 끝이 아니에요.
  const re = /[^\n.!?。]+(?:(?<=\d)\.(?=\d)[^\n.!?。]*)*/g;
  for (const m of text.matchAll(re)) {
    let start = m.index!;
    let raw = m[0];
    const bullet = raw.match(/^\s*(?:[-•*·]|\d+[.)])\s+/);
    if (bullet) {
      start += bullet[0].length;
      raw = raw.slice(bullet[0].length);
    }
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    const para = breaks.filter((b) => b < m.index!).length;
    if (body) pieces.push({ text: body, start: start + lead, para });
  }
  return pieces;
}

// ---------- 할 일·아이디어 표현 ----------

/** "보내야 함", "제출해야 돼", "사기", "할 것" 같은 끝맺음 */
const TASK_END =
  /(?:야\s*(?:함|해|돼|됨|한다|된다|하는데|지|겠다)?|해야지|할\s*것|하기|챙기기|잊지\s*말기)\s*[.!]?$/;
/** 제목 앞에서 지울 연결 말 */
const LEAD_FILLER = /^(?:그\s*전에|그\s*다음에?|그리고|이후에?|끝나고|꼭|반드시|잊지\s*말고)\s+/;
/** "아이디어:"로 시작하면 다른 규칙보다 먼저 아이디어예요. */
const IDEA_PREFIX = /^(?:아이디어|idea)\s*[:：]\s*/i;
/** "~면 좋겠다", "~해볼까" */
const IDEA =
  /(?:면\s*좋겠다|면\s*좋을\s*(?:듯|것\s*같)|해\s*볼까|해\s*보자|어떨까|어때\??|하고\s*싶다)/;
/** "먹었다", "다녀왔음" 같은 지난 일은 일정으로 만들지 않아요. */
const PAST = /(?:었|았|였|했|왔|갔|봤|났)(?:다|음|어|네|지)\s*[.!]?$/;
/** "오늘 할 일", "할 일:", "투두" 같은 목록 제목. 앞부분은 마감 날짜로 써요. */
const TASK_HEADER =
  /^(.*?)\s*(?:할\s*일|해야\s*할\s*(?:일|것)|투두|todo|to-do)\s*(?:목록|리스트)?\s*[:：]?$/i;

/** "견적서 보내야 함" → "견적서 보내기", "과제 제출해야 돼" → "과제 제출하기" */
export function taskTitle(title: string): string {
  let t = title.replace(LEAD_FILLER, '').trim();
  const m = t.match(/^(.*?)(해|[어아여])?야\s*(?:함|해|돼|됨|한다|된다|하는데|지|겠다)?\s*[.!]?$/);
  if (m && m[1]) {
    const stem = m[1];
    if (m[2] === '해') t = `${stem}하기`;
    else if (m[2]) t = `${stem}기`;
    else t = `${stem}기`;
  }
  t = t.replace(/\s*(?:할\s*것)$/, '하기');
  return t;
}

const clean = (title: string) => title.replace(LEAD_FILLER, '').trim();

// ---------- 카드 만들기 ----------

export interface ExtractContext {
  noteId: string;
  /** 시간대 기준 지금 (실제 순간) */
  now: Date;
  timezone: string;
}

type Draft = Omit<Card, 'id' | 'createdAt' | 'status'>;

/** "할 일" 목록 제목 아래에 있을 때: 목록 항목은 할 일이고, 제목의 날짜가 기본 마감이에요. */
export interface TaskList {
  para: number;
  dueAt?: string;
}

/** 조각이 "오늘 할 일" 같은 목록 제목이면 목록 정보를 돌려줘요. */
export function taskHeader(piece: Piece, ctx: ExtractContext): TaskList | undefined {
  const m = piece.text.match(TASK_HEADER);
  if (!m) return undefined;
  const list: TaskList = { para: piece.para };
  if (m[1]) {
    const e = parseEvent(m[1], { now: toLocalFrame(ctx.now, ctx.timezone) });
    if (e.title) return undefined; // "보고서 할 일"처럼 날짜가 아닌 말이 앞에 있으면 제목이 아니에요.
    Object.assign(
      list,
      due(e, (d) => fromLocalFrame(d, ctx.timezone).toISOString()),
    );
  }
  return list;
}

/** 조각 하나 → 카드 후보 (일정·할 일·아이디어 하나 + 사람 여러 명) */
export function pieceToCards(piece: Piece, ctx: ExtractContext, list?: TaskList): Draft[] {
  const e = parseEvent(piece.text, { now: toLocalFrame(ctx.now, ctx.timezone) });
  const at = (d: Date) => fromLocalFrame(d, ctx.timezone).toISOString();
  const source = (s: number, end: number): Draft['source'] => ({
    kind: 'note',
    noteId: ctx.noteId,
    span: [piece.start + s, piece.start + end],
  });
  const whole = source(0, piece.text.length);
  const out: Draft[] = [];

  const hasWhen = e.spans.some((s) => s.field === 'date' || s.field === 'time');
  const until = e.spans.some((s) => s.field === 'date' && /까지$/.test(s.text));
  const isTask = !!list || e.type === 'task' || until || TASK_END.test(piece.text);

  if (IDEA_PREFIX.test(piece.text)) {
    out.push({ type: 'idea', title: piece.text.replace(IDEA_PREFIX, ''), source: whole });
  } else if (isTask) {
    const dueAt = due(e, at).dueAt ?? list?.dueAt;
    out.push({
      type: 'task',
      title: taskTitle(e.title || piece.text),
      source: whole,
      ...(dueAt ? { dueAt } : {}),
    });
  } else if (hasWhen && e.start && !PAST.test(piece.text)) {
    out.push({
      type: 'event',
      title: clean(e.title) || '일정',
      startAt: at(e.start),
      ...(e.end ? { endAt: at(e.end) } : {}),
      source: whole,
    });
  } else if (IDEA.test(piece.text)) {
    out.push({ type: 'idea', title: piece.text, source: whole });
  }

  // "민수, 지영이랑"처럼 한 구간에 여러 명이 있을 수 있어요.
  for (const s of e.spans.filter((x) => x.field === 'attendee')) {
    let from = 0;
    for (const name of e.attendees) {
      const i = s.text.indexOf(name, from);
      if (i < 0) continue;
      from = i + name.length;
      const offset = s.start + i;
      out.push({
        type: 'person',
        title: name,
        personName: name,
        source: source(offset, offset + name.length),
      });
    }
  }
  return out;
}

/** 할 일 마감: 시각이 있으면 그 시각, 날짜만 있으면 그날 23:59 */
function due(e: ParsedEvent, at: (d: Date) => string): Pick<Card, 'dueAt'> {
  if (!e.start) return {};
  if (!e.allDay) return { dueAt: at(e.start) };
  const d = new Date(e.start);
  d.setHours(23, 59, 0, 0);
  return { dueAt: at(d) };
}

export function extractByRules(note: Note, ctx: Omit<ExtractContext, 'noteId'>): Card[] {
  const createdAt = ctx.now.toISOString();
  const seenPeople = new Set<string>();
  const cards: Card[] = [];
  const full = { ...ctx, noteId: note.id };
  let list: TaskList | undefined;
  for (const piece of splitPieces(note.text)) {
    if (list && list.para !== piece.para) list = undefined;
    const header = taskHeader(piece, full);
    if (header) {
      list = header;
      continue;
    }
    for (const d of pieceToCards(piece, full, list)) {
      if (d.type === 'person') {
        if (seenPeople.has(d.personName!)) continue;
        seenPeople.add(d.personName!);
      }
      cards.push({
        ...d,
        id: `${note.id}:${d.type}:${d.source.span[0]}`,
        status: 'suggested',
        createdAt,
      });
    }
  }
  return cards;
}
