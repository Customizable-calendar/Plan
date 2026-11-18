import {
  type SttMark,
  type SttNote,
  type SttNoteRow,
  toSttNote,
  toSttNoteInsert,
} from '@noteapp/shared';

import { localFirstTable } from '@/lib/local-first';

import type { SttResult, SttSegment } from './engine';

// 받아쓰기 기록(녹음 노트) 저장소. 테이블: stt_notes. (담당: B)
// 받아쓰기가 끝나면 받아쓴 글, 줄 시각, 화자, 북마크·메모를 남겨서 나중에 녹음 노트를 다시 열어요.
// 메모와 같은 방식이에요: 로그인 전엔 이 기기에만, 로그인 후엔 기기와 계정 둘 다(lib/local-first.ts).
// 계정 연결은 'stt' 기능을 따라가요. 소리(녹음 원본 WAV)는 기기에만 있고 계정에 안 올라가요.

const table = localFirstTable<SttNote>({
  feature: 'stt',
  table: 'stt_notes',
  toRow: toSttNoteInsert,
  fromRow: (row) => toSttNote(row as SttNoteRow),
});

/** 기록 전부, 최근 것부터 */
export async function listSttNotes(): Promise<SttNote[]> {
  return (await table.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveSttNote(note: SttNote): Promise<void> {
  await table.put([{ ...note, updatedAt: new Date().toISOString() }]);
}

export async function removeSttNote(id: string): Promise<void> {
  await table.remove([id]);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 기록 이름: 받아쓰기 11/18 09:30 */
export function noteTitle(at: Date): string {
  return `받아쓰기 ${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** 받아쓰기 결과로 기록을 만들어요. id와 만든 시각은 처음 한 번 정해서 넘겨요(고칠 때도 같은 기록). */
export function noteFromResult(input: {
  id: string;
  createdAt: string;
  result: SttResult;
  segments: SttSegment[];
  marks: SttMark[];
  modelId?: string;
}): SttNote {
  const { id, createdAt, result, segments, marks, modelId } = input;
  const note: SttNote = {
    id,
    title: noteTitle(new Date(createdAt)),
    text: result.text,
    segments: segments.map((s) =>
      s.speaker === undefined
        ? { text: s.text, startMs: s.startMs, endMs: s.endMs }
        : { text: s.text, startMs: s.startMs, endMs: s.endMs, speaker: s.speaker },
    ),
    marks,
    durationMs: result.durationMs,
    createdAt,
    updatedAt: createdAt,
  };
  if (result.recordingId) note.recordingId = result.recordingId;
  if (modelId) note.modelId = modelId;
  return note;
}

/** 기록을 녹음 노트가 쓰는 받아쓰기 결과 모양으로 */
export function resultOfNote(note: SttNote): SttResult {
  return {
    text: note.text,
    segments: note.segments,
    durationMs: note.durationMs,
    ...(note.recordingId ? { recordingId: note.recordingId } : {}),
  };
}
