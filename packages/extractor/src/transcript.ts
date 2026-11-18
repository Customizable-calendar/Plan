// 받아쓴 글을 시각이 붙은 줄로 나누고, 시각 붙은 글·자막(SRT)으로 바꿔요. (담당: B)
// 받아쓰기 엔진(whisper)은 문장이 아니라 몇 초짜리 덩어리로 시각을 줘요. 덩어리 안 문장은
// 글자 수로 시간을 나눠 짐작하고, 문장이 끝나거나 오래 쉬거나 너무 길어지면 줄을 나눠요(SpokenLog 참고).

import { punctuateSpoken } from './spoken';

/** 받아쓰기 엔진이 준 덩어리. ms는 녹음 시작부터예요. */
export interface TimedText {
  text: string;
  startMs: number;
  endMs: number;
  /** 화자 구분을 했으면 말한 사람(0부터). 바뀌면 줄을 나눠요. */
  speaker?: number;
}

/** 화자 구분 결과 한 구간(누가 언제 말했는지) */
export interface SpeakerTurn {
  startMs: number;
  endMs: number;
  /** 0부터 */
  speaker: number;
}

/** 이만큼 넘게 쉬면 줄을 나눠요. */
const GAP_MS = 1500;
/** 한 줄이 이만큼 넘게 길어지면 문장이 안 끝나도 나눠요. */
const MAX_LINE_MS = 7000;

const endsSentence = (text: string) => /[.?!。]$/.test(text);

/** 덩어리 하나를 문장으로 나누고, 덩어리 시간을 글자 수만큼 나눠 줘요. */
function sentencesOf(segment: TimedText): TimedText[] {
  const parts = punctuateSpoken(segment.text)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const span = Math.max(0, segment.endMs - segment.startMs);
  let at = segment.startMs;
  return parts.map((text, i) => {
    const endMs =
      i === parts.length - 1 ? segment.endMs : at + Math.round((span * text.length) / total);
    const piece: TimedText = { text, startMs: at, endMs };
    if (segment.speaker !== undefined) piece.speaker = segment.speaker;
    at = endMs;
    return piece;
  });
}

/**
 * 받아쓴 덩어리들을 읽기 좋은 줄로 나눠요. 한 줄은 대개 한 문장이에요.
 * - 문장이 끝나면 나눠요.
 * - 앞 줄과 1.5초 넘게 쉬었으면 나눠요.
 * - 7초가 넘어가면 문장이 안 끝나도 나눠요.
 * - 말한 사람이 바뀌면 나눠요.
 */
export function timedLines(segments: TimedText[]): TimedText[] {
  const lines: TimedText[] = [];
  let current = null as TimedText | null;
  for (const piece of segments.flatMap(sentencesOf)) {
    if (
      current &&
      (endsSentence(current.text) ||
        piece.speaker !== current.speaker ||
        piece.startMs - current.endMs > GAP_MS ||
        piece.endMs - current.startMs > MAX_LINE_MS)
    ) {
      lines.push(current);
      current = null;
    }
    const prev = current;
    current = prev
      ? { ...prev, text: `${prev.text} ${piece.text}`, endMs: piece.endMs }
      : { ...piece };
  }
  if (current) lines.push(current);
  return lines;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** 63000 → "1:03", 3723000 → "1:02:03" */
export function clockOf(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** 화자 이름. 0 → "화자 1" */
export const speakerLabel = (speaker: number) => `화자 ${speaker + 1}`;

const withSpeaker = (l: TimedText) =>
  l.speaker === undefined ? l.text : `${speakerLabel(l.speaker)}: ${l.text}`;

/** 줄마다 시각을 붙인 글. "[0:05] 회의를 시작하겠습니다." (화자가 있으면 "[0:05] 화자 1: …") */
export function toTimedText(lines: TimedText[]): string {
  return lines.map((l) => `[${clockOf(l.startMs)}] ${withSpeaker(l)}`).join('\n');
}

/** 화자마다 줄을 나눈 글. 같은 사람이 이어 말하면 한 줄로 붙여요. "화자 1: …" */
export function toSpeakerText(lines: TimedText[]): string {
  const out: { speaker?: number; text: string }[] = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && last.speaker === l.speaker) last.text += ` ${l.text}`;
    else out.push({ speaker: l.speaker, text: l.text });
  }
  return out
    .map((o) => (o.speaker === undefined ? o.text : `${speakerLabel(o.speaker)}: ${o.text}`))
    .join('\n');
}

/**
 * 받아쓴 덩어리마다 가장 오래 겹치는 사람을 붙여요. 아무와도 안 겹치면 제일 가까운 사람이에요.
 * 화자 번호는 처음 말한 순서대로 0, 1, 2…로 다시 매겨요.
 */
export function assignSpeakers<T extends { startMs: number; endMs: number }>(
  segments: T[],
  turns: SpeakerTurn[],
): (T & { speaker?: number })[] {
  if (turns.length === 0) return segments;
  const order = new Map<number, number>();
  const renumber = (speaker: number) => {
    if (!order.has(speaker)) order.set(speaker, order.size);
    return order.get(speaker)!;
  };
  return segments.map((seg) => {
    const overlap = new Map<number, number>();
    for (const t of turns) {
      const ms = Math.min(seg.endMs, t.endMs) - Math.max(seg.startMs, t.startMs);
      if (ms > 0) overlap.set(t.speaker, (overlap.get(t.speaker) ?? 0) + ms);
    }
    let best: number | undefined;
    let bestMs = 0;
    for (const [speaker, ms] of overlap)
      if (ms > bestMs) {
        best = speaker;
        bestMs = ms;
      }
    if (best === undefined) {
      const mid = (seg.startMs + seg.endMs) / 2;
      let nearest = Infinity;
      for (const t of turns) {
        const gap = Math.min(Math.abs(t.startMs - mid), Math.abs(t.endMs - mid));
        if (gap < nearest) {
          nearest = gap;
          best = t.speaker;
        }
      }
    }
    return best === undefined ? seg : { ...seg, speaker: renumber(best) };
  });
}

/** 3723456 → "01:02:03,456" (SRT 시각) */
function srtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(t % 1000, 3)}`;
}

/** 자막 파일(SRT) 글. 동영상 편집기·플레이어에서 열 수 있어요. */
export function toSrt(lines: TimedText[]): string {
  return lines
    .map((l, i) => {
      // 끝이 시작보다 앞서면 안 돼요. 최소 0.5초는 보이게 해요.
      const endMs = Math.max(l.endMs, l.startMs + 500);
      return `${i + 1}\n${srtTime(l.startMs)} --> ${srtTime(endMs)}\n${withSpeaker(l)}\n`;
    })
    .join('\n');
}
