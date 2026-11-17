// 말소리 감지(VAD) 결과로 녹음을 자르고 다듬는 순수 함수들이에요. (담당: B)
// VAD 모델을 부르는 건 vad.ts, 여기는 계산만 해요.

import { BYTES_PER_SECOND } from './chunker';

/** 말소리가 있는 곳. 이 조각 시작부터 ms */
export interface Span {
  startMs: number;
  endMs: number;
}

/** 이보다 짧게 쉰 곳은 자를 곳으로 안 봐요. */
const MIN_GAP_MS = 150;
/** 이보다 길게 조용한 곳만 소리를 지워요. 짧게 쉰 곳은 그대로 둬요(작은 말소리를 놓치지 않게). */
const MUTE_GAP_MS = 1000;
/** 말소리 앞뒤로 남겨 두는 여유(ms) */
const EDGE_MS = 300;

const toBytes = (ms: number) => Math.round((ms / 1000) * BYTES_PER_SECOND) & ~1; // 2바이트 단위
const toMs = (bytes: number) => Math.round((bytes / BYTES_PER_SECOND) * 1000);

/**
 * 말이 쉬는 곳 중 minBytes 뒤에서 제일 길게 쉰 곳의 가운데(바이트)를 골라요.
 * 말소리가 하나도 없으면 전부 잘라도 돼서 totalBytes, 쉬는 곳이 없으면 null이에요.
 */
export function cutAtGap(spans: Span[], totalBytes: number, minBytes: number): number | null {
  if (spans.length === 0) return totalBytes;
  const totalMs = toMs(totalBytes);
  const gaps: Span[] = [];
  for (let i = 0; i < spans.length; i++) {
    const end = spans[i]!.endMs;
    const next = i + 1 < spans.length ? spans[i + 1]!.startMs : totalMs;
    gaps.push({ startMs: end, endMs: next });
  }
  let best: Span | null = null;
  for (const gap of gaps) {
    const length = gap.endMs - gap.startMs;
    if (length < MIN_GAP_MS) continue;
    const middle = toBytes((gap.startMs + gap.endMs) / 2);
    if (middle < minBytes || middle > totalBytes) continue;
    if (!best || length > best.endMs - best.startMs) best = gap;
  }
  return best ? toBytes((best.startMs + best.endMs) / 2) : null;
}

/**
 * 조각에서 말소리만 남겨요. 앞뒤 조용한 곳은 잘라 내고, 중간에 길게 조용한 곳은 소리를 지워요.
 * 잡음만 있는 곳을 whisper가 듣고 없는 말을 지어내지 않게 해요. 시간은 그대로 맞춰요.
 * 말소리가 없으면 null이에요.
 */
export function keepSpeech(
  pcm: Uint8Array,
  offsetMs: number,
  spans: Span[],
): { pcm: Uint8Array; offsetMs: number } | null {
  if (spans.length === 0) return null;
  const from = Math.max(0, toBytes(spans[0]!.startMs - EDGE_MS));
  const to = Math.min(pcm.length, toBytes(spans[spans.length - 1]!.endMs + EDGE_MS));
  if (to <= from) return null;
  const out = pcm.slice(from, to);
  for (let i = 0; i + 1 < spans.length; i++) {
    const quietFrom = spans[i]!.endMs + EDGE_MS;
    const quietTo = spans[i + 1]!.startMs - EDGE_MS;
    if (quietTo - quietFrom < MUTE_GAP_MS - 2 * EDGE_MS) continue;
    out.fill(0, Math.max(0, toBytes(quietFrom) - from), Math.max(0, toBytes(quietTo) - from));
  }
  return { pcm: out, offsetMs: offsetMs + toMs(from) };
}
