/** 받아쓴 덩어리 하나. ms는 녹음 시작부터예요. (담당: B) */
export interface SttNoteSegment {
  text: string;
  startMs: number;
  endMs: number;
  /** 화자 구분을 했으면 말한 사람(0부터) */
  speaker?: number;
}

/** 녹음 중에 남긴 표시. text가 없으면 북마크예요. */
export interface SttMark {
  ms: number;
  text?: string;
}

/**
 * 받아쓰기 기록 하나(녹음 노트). 받아쓴 글과 시각, 화자, 북마크·메모를 남겨요.
 * 소리(녹음 원본)는 기기에만 있어요(recordingId).
 */
export interface SttNote {
  id: string;
  title: string;
  /** 받아쓴 글 전체 */
  text: string;
  segments: SttNoteSegment[];
  marks: SttMark[];
  durationMs: number;
  /** 이 기기에 남긴 녹음 원본 id. 없으면 원본을 안 남겼어요. */
  recordingId?: string;
  /** 받아쓴 모델 id(small, base, sensevoice) */
  modelId?: string;
  createdAt: string;
  updatedAt: string;
}
