import type { SpeakerTurn } from '@noteapp/extractor';

import { downloadModel, isDownloaded, packDir, packFile, SPEAKER_MODEL } from './models';
import type { Recording } from './recordings';
import { hasSherpa, sherpa } from './sherpa';
// 화자 구분: 녹음 원본에서 누가 언제 말했는지 나눠서 받아쓴 글에 "화자 1, 화자 2"를 붙여요. (담당: B)
// sherpa-onnx(pyannote 분할 + 3D-Speaker 목소리 특징)를 기기 안에서 돌려요. 소리는 밖으로 안 나가요(SpokenLog 참고).
// "화자 1"은 이 녹음 안에서 목소리를 나눈 것일 뿐, 실제로 누구인지는 몰라요.
// 녹음 원본(WAV)이 있어야 해요: "녹음 원본 남기기"를 켜고 녹음했거나, 파일을 가져온 녹음이요.

/** 이보다 긴 녹음은 메모리가 모자랄 수 있어서 나누지 않아요. */
export const MAX_SPEAKER_SECONDS = 30 * 60;

interface SherpaDiarization {
  init(config: {
    segmentationModelDir: string;
    segmentationModelFile?: string;
    embeddingModelFile: string;
    numThreads?: number;
    minDurationOn?: number;
    minDurationOff?: number;
    numClusters?: number;
    threshold?: number;
  }): Promise<{ success: boolean; error?: string }>;
  processFile(
    filePath: string,
    numClusters?: number,
    threshold?: number,
  ): Promise<{
    success: boolean;
    segments: { start: number; end: number; speaker: number }[];
    error?: string;
  }>;
  release(): Promise<unknown>;
}

const diarization = () => (sherpa() as { Diarization: SherpaDiarization }).Diarization;

/** 이 앱 빌드에서 화자 구분을 쓸 수 있는지(새 APK, Android) */
export const canFindSpeakers = hasSherpa;

export const speakerModelReady = () => isDownloaded(SPEAKER_MODEL);

export const downloadSpeakerModel = (onProgress: (ratio: number) => void, signal?: AbortSignal) =>
  downloadModel(SPEAKER_MODEL, onProgress, signal);

/**
 * 녹음 원본에서 말한 사람 구간을 찾아요. speakers: 사람 수를 알면(2~8), 모르면 알아서 찾아요.
 * SpokenLog와 같은 기본값이에요(threshold 0.5, 말 0.3초, 쉼 0.5초).
 */
export async function findSpeakers(
  recording: Recording,
  speakers?: number,
): Promise<SpeakerTurn[]> {
  if (recording.seconds > MAX_SPEAKER_SECONDS)
    throw new Error(`화자 구분은 ${MAX_SPEAKER_SECONDS / 60}분 이하 녹음만 돼요.`);
  if (!speakerModelReady()) throw new Error('먼저 화자 구분 모델을 받아 주세요.');
  const d = diarization();
  const numClusters = speakers && speakers >= 2 ? speakers : -1;
  const init = await d.init({
    segmentationModelDir: packDir(SPEAKER_MODEL).uri,
    segmentationModelFile: SPEAKER_MODEL.files[0]!.name,
    embeddingModelFile: packFile(SPEAKER_MODEL, SPEAKER_MODEL.files[1]!.name).uri,
    numThreads: 4,
    minDurationOn: 0.3,
    minDurationOff: 0.5,
    numClusters,
    threshold: 0.5,
  });
  if (!init.success) throw new Error(init.error ?? '화자 구분 모델을 열지 못했어요.');
  try {
    const result = await d.processFile(recording.file.uri, numClusters, 0.5);
    if (!result.success) throw new Error(result.error ?? '화자를 나누지 못했어요.');
    // 결과는 초 단위예요.
    return result.segments.map((s) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      speaker: s.speaker,
    }));
  } finally {
    await d.release().catch(() => {});
  }
}

// 받아쓴 덩어리에 화자를 붙이는 건 순수 함수라 @noteapp/extractor에 있어요(시험 있음).
export { assignSpeakers } from '@noteapp/extractor';
