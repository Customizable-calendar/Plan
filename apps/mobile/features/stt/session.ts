import { Directory, File, Paths } from 'expo-file-system';

import type { SttSegment } from './engine';

// 받아쓰는 중인 녹음을 기기에 적어 둬요. 앱이 꺼져도 다음에 이어서 받아쓸 수 있어요.
//   Documents/stt/session/<시작ms>.pcm  아직 안 받아쓴 조각 (받아쓰면 지워요)
//   Documents/stt/session/segments.json 받아쓴 글
// 기기 안에만 있고 밖으로 안 나가요. 끝내거나 버리면 폴더째 지워요.

function dir(): Directory {
  const d = new Directory(Paths.document, 'stt', 'session');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

const segmentsFile = () => new File(dir(), 'segments.json');

export interface SavedChunk {
  offsetMs: number;
  file: File;
}

export async function saveChunk(offsetMs: number, pcm: Uint8Array): Promise<SavedChunk> {
  const file = new File(dir(), `${offsetMs}.pcm`);
  await file.write(pcm);
  return { offsetMs, file };
}

export async function saveSegments(segments: SttSegment[]): Promise<void> {
  await segmentsFile().write(JSON.stringify(segments));
}

/** 받아쓰다 만 녹음. 없으면 null */
export function leftover(): { segments: SttSegment[]; chunks: SavedChunk[] } | null {
  const d = new Directory(Paths.document, 'stt', 'session');
  if (!d.exists) return null;
  const chunks: SavedChunk[] = [];
  for (const item of d.list()) {
    const m = item instanceof File ? /^(\d+)\.pcm$/.exec(item.name) : null;
    if (m) chunks.push({ offsetMs: Number(m[1]), file: item as File });
  }
  chunks.sort((a, b) => a.offsetMs - b.offsetMs);
  let segments: SttSegment[] = [];
  const saved = new File(d, 'segments.json');
  if (saved.exists) {
    try {
      segments = JSON.parse(saved.textSync()) as SttSegment[];
    } catch {
      segments = [];
    }
  }
  if (chunks.length === 0 && segments.length === 0) {
    clearSession();
    return null;
  }
  return { segments, chunks };
}

export function clearSession(): void {
  const d = new Directory(Paths.document, 'stt', 'session');
  if (d.exists) d.delete();
}
