// 긴 녹음을 말이 쉬는 곳에서 20~30초 조각으로 잘라요. (담당: B)
// 조각마다 따로 받아써서 녹음 길이에 상관없이 메모리는 조각 하나만큼만 써요.
// 소리 크기(RMS)만 보는 단순한 방법이라 네이티브 모듈이 필요 없어요.

export const SAMPLE_RATE = 16_000;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2; // 16비트 모노

/** 이만큼 모이면 쉬는 곳을 찾기 시작해요. */
const MIN_BYTES = 20 * BYTES_PER_SECOND;
/** 이만큼 모이면 쉬는 곳이 없어도 제일 조용한 곳에서 잘라요. */
const MAX_BYTES = 30 * BYTES_PER_SECOND;
/** 이만큼 조용하면 말이 쉰 거로 봐요. */
const PAUSE_BYTES = 0.4 * BYTES_PER_SECOND;
/** 조각 전체에서 제일 큰 소리가 이보다 작으면 말이 없는 조각이에요. (16비트 최대 32767) */
const SILENT_RMS = 300;

interface Piece {
  bytes: Uint8Array;
  rms: number;
}

export interface Chunk {
  pcm: Uint8Array;
  /** 녹음 시작부터 이 조각이 시작하는 곳(ms) */
  offsetMs: number;
  /** 말이 없는 조각. 받아쓰면 없는 말을 지어낼 수 있어서 건너뛰어요. */
  silent: boolean;
}

export function rmsOf(bytes: Uint8Array): number {
  const n = Math.floor(bytes.length / 2);
  if (n === 0) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = view.getInt16(i * 2, true);
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * 녹음 데이터를 받아서 조각이 되면 onChunk로 넘겨요.
 * push()는 녹음 데이터가 올 때마다, flush()는 녹음을 끝낼 때 불러요.
 */
export function createChunker(onChunk: (chunk: Chunk) => void) {
  let pieces: Piece[] = [];
  let pending = 0;
  let emitted = 0; // 지금까지 넘긴 바이트

  const emit = (count: number) => {
    const taken = pieces.slice(0, count);
    pieces = pieces.slice(count);
    const size = taken.reduce((s, p) => s + p.bytes.length, 0);
    pending -= size;
    const pcm = new Uint8Array(size - (size % 2));
    let at = 0;
    for (const p of taken) {
      const n = Math.min(p.bytes.length, pcm.length - at);
      pcm.set(p.bytes.subarray(0, n), at);
      at += n;
    }
    const offsetMs = Math.round((emitted / BYTES_PER_SECOND) * 1000);
    emitted += size;
    const loudest = taken.reduce((m, p) => Math.max(m, p.rms), 0);
    if (pcm.length > 0) onChunk({ pcm, offsetMs, silent: loudest < SILENT_RMS });
  };

  /** 끝에서 PAUSE_BYTES만큼이 조각 평소 소리보다 확실히 작으면 쉬는 곳이에요. */
  const endsWithPause = () => {
    const level = median(pieces.map((p) => p.rms));
    let quiet = 0;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]!;
      if (p.rms > Math.max(level * 0.35, SILENT_RMS * 0.5)) break;
      quiet += p.bytes.length;
      if (quiet >= PAUSE_BYTES) return true;
    }
    return false;
  };

  /** MIN~MAX 사이에서 제일 조용한 곳 바로 뒤까지의 개수 */
  const quietestCut = () => {
    let at = 0;
    let best = pieces.length;
    let bestRms = Infinity;
    for (let i = 0; i < pieces.length; i++) {
      at += pieces[i]!.bytes.length;
      if (at < MIN_BYTES) continue;
      if (pieces[i]!.rms <= bestRms) {
        bestRms = pieces[i]!.rms;
        best = i + 1;
      }
    }
    return best;
  };

  return {
    push(bytes: Uint8Array) {
      pieces.push({ bytes, rms: rmsOf(bytes) });
      pending += bytes.length;
      if (pending < MIN_BYTES) return;
      if (endsWithPause()) emit(pieces.length);
      else if (pending >= MAX_BYTES) emit(quietestCut());
    },
    flush() {
      if (pieces.length) emit(pieces.length);
    },
    /** 아직 조각이 안 된 소리 길이(바이트) */
    pendingBytes: () => pending,
  };
}
