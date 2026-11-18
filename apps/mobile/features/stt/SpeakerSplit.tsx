import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { SttSegment } from './engine';
import { listRecordings } from './recordings';
import { SmallButton } from './SmallButton';
import {
  assignSpeakers,
  canFindSpeakers,
  downloadSpeakerModel,
  findSpeakers,
  MAX_SPEAKER_SECONDS,
  speakerModelReady,
} from './speakers';

type Step =
  | { kind: 'idle' }
  | { kind: 'downloading'; ratio: number }
  | { kind: 'finding' }
  | { kind: 'done'; speakers: number }
  | { kind: 'error'; message: string };

const COUNTS: { label: string; value?: number }[] = [
  { label: '알아서' },
  { label: '2명', value: 2 },
  { label: '3명', value: 3 },
  { label: '4명', value: 4 },
];

/**
 * 받아쓴 글에 "화자 1, 화자 2"를 붙여요(기기 안 sherpa-onnx, speakers.ts).
 * 녹음 원본이 있어야 해요(recordingId). 없거나 이 빌드에 엔진이 없으면 안 보여요.
 */
export function SpeakerSplit({
  recordingId,
  segments,
  onSegments,
}: {
  recordingId?: string;
  segments: SttSegment[];
  onSegments: (segments: SttSegment[]) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [count, setCount] = useState<number | undefined>(undefined);
  if (!recordingId || !canFindSpeakers() || segments.length === 0) return null;
  const recording = listRecordings().find((r) => r.id === recordingId);
  if (!recording) return null;
  const tooLong = recording.seconds > MAX_SPEAKER_SECONDS;

  const run = async () => {
    try {
      if (!speakerModelReady()) {
        setStep({ kind: 'downloading', ratio: 0 });
        await downloadSpeakerModel((ratio) => setStep({ kind: 'downloading', ratio }));
      }
      setStep({ kind: 'finding' });
      const turns = await findSpeakers(recording, count);
      const labeled = assignSpeakers(segments, turns);
      onSegments(labeled);
      setStep({ kind: 'done', speakers: new Set(labeled.map((s) => s.speaker)).size });
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <View className="gap-2 border-t border-border pt-3">
      <Text className="text-[13px] font-bold text-muted-foreground">누가 말했는지 나누기</Text>
      {tooLong ? (
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {MAX_SPEAKER_SECONDS / 60}분 이하 녹음만 나눌 수 있어요.
        </Text>
      ) : step.kind === 'downloading' ? (
        <Busy label={`화자 구분 모델 받는 중 ${Math.round(step.ratio * 100)}%`} />
      ) : step.kind === 'finding' ? (
        <Busy label="목소리를 나누는 중이에요" />
      ) : (
        <>
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {step.kind === 'done'
              ? `${step.speakers}명으로 나눴어요. "화자 1"은 목소리로 나눈 것이라 실제 이름은 몰라요.`
              : `녹음 원본으로 이 기기 안에서 목소리를 나눠요.${speakerModelReady() ? '' : ' 처음엔 모델(45MB)을 받아요.'}`}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {COUNTS.map((c) => (
              <SmallButton
                key={c.label}
                label={c.label}
                primary={count === c.value}
                onPress={() => setCount(c.value)}
              />
            ))}
          </View>
          {step.kind === 'error' ? (
            <Text className="text-[14px] leading-5 text-destructive">{step.message}</Text>
          ) : null}
          <SmallButton
            label={step.kind === 'done' ? '다시 나누기' : '화자 나누기'}
            primary
            onPress={() => void run()}
          />
        </>
      )}
    </View>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <ActivityIndicator />
      <Text className="text-[14px] text-muted-foreground">{label}</Text>
    </View>
  );
}
