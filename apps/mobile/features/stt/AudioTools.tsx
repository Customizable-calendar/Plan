import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SPEECH_LEVEL } from './chunker';
import { testMicrophone } from './engine';
import { listRecordings, type Recording, recordingsBytes, removeRecording } from './recordings';
import { SmallButton } from './SmallButton';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 소리 크기 막대(0~1). 말이 들릴 만큼이면 진한 색이에요. */
export function LevelBar({ level }: { level: number }) {
  const heard = level >= SPEECH_LEVEL;
  return (
    <View
      className="h-2 overflow-hidden rounded-full bg-muted"
      accessibilityRole="progressbar"
      accessibilityLabel="마이크 소리 크기"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
    >
      <View
        className={`h-2 rounded-full ${heard ? 'bg-primary' : 'bg-muted-foreground'}`}
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </View>
  );
}

/** 이만큼 지나면 마이크 확인을 알아서 멈춰요. */
const CHECK_MS = 10_000;

/** 녹음 전에 마이크 소리가 잘 들어오는지 막대로 봐요. 녹음은 안 해요(Whispering 참고). */
export function MicCheck() {
  const [level, setLevel] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  const stop = async () => {
    const s = stopRef.current;
    stopRef.current = null;
    setLevel(null);
    await s?.().catch(() => {});
  };

  useEffect(() => {
    if (level === null) return;
    const timer = setTimeout(() => void stop(), CHECK_MS);
    return () => clearTimeout(timer);
    // 켤 때 한 번만 시간을 재요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level === null]);

  // 화면을 나가면 마이크를 닫아요.
  useEffect(() => () => void stopRef.current?.().catch(() => {}), []);

  const startCheck = async () => {
    setError(null);
    setHeard(false);
    try {
      stopRef.current = await testMicrophone((l) => {
        setLevel(l);
        if (l >= SPEECH_LEVEL) setHeard(true);
      });
      setLevel(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-2">
      {level === null ? (
        <SmallButton label="마이크 확인" onPress={() => void startCheck()} />
      ) : (
        <View className="gap-2 rounded-xl border border-border bg-card p-4">
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {heard
              ? '잘 들려요. 이대로 말하기를 시작하면 돼요.'
              : '아무 말이나 해 보세요. 막대가 진하게 움직이면 잘 들리는 거예요.'}
          </Text>
          <LevelBar level={level} />
          <SmallButton label="확인 끝" onPress={() => void stop()} />
        </View>
      )}
      {error ? <Text className="text-[14px] text-destructive">{error}</Text> : null}
    </View>
  );
}

/** 녹음 원본 남기기 켜고 끄기 */
export function KeepAudioToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-bold text-foreground">녹음 원본 남기기</Text>
        <Text className="text-[13px] leading-5 text-muted-foreground">
          소리를 이 기기에만 남겨서 나중에 다시 받아쓸 수 있어요. 1시간에 약 115MB예요.
        </Text>
      </View>
      <View
        className={`h-7 w-12 justify-center rounded-full px-1 ${on ? 'bg-primary' : 'bg-muted'}`}
      >
        <View className={`h-5 w-5 rounded-full bg-background ${on ? 'self-end' : 'self-start'}`} />
      </View>
    </Pressable>
  );
}

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
    : `${Math.round(bytes / 1024 / 1024)}MB`;

/**
 * 남겨 둔 녹음 원본 목록. 지금 고른 모델로 다시 받아쓰거나 지워요.
 * refreshKey가 바뀌면 다시 읽어요(받아쓰기가 끝났을 때 등).
 */
export function RecordingList({
  refreshKey,
  onAgain,
}: {
  refreshKey: string;
  onAgain: (recording: Recording) => void;
}) {
  // 지우면 version을 올려서 다시 읽어요.
  const [version, setVersion] = useState(0);
  const { list, bytes } = useMemo(() => {
    void refreshKey;
    void version;
    try {
      return { list: listRecordings(), bytes: recordingsBytes() };
    } catch {
      return { list: [] as Recording[], bytes: 0 };
    }
  }, [refreshKey, version]);

  if (list.length === 0) return null;
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-muted-foreground">
        남긴 녹음 {list.length}개 · {sizeLabel(bytes)}
      </Text>
      {list.map((r) => (
        <View
          key={r.id}
          className="flex-row items-center gap-2 rounded-xl border border-border bg-card p-3"
        >
          <Text className="flex-1 text-[14px] text-foreground">
            {r.startedAt.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
            {clock(r.seconds)}
          </Text>
          <SmallButton label="다시 받아쓰기" onPress={() => onAgain(r)} />
          <SmallButton
            label="지우기"
            onPress={() => {
              removeRecording(r.id);
              setVersion((v) => v + 1);
            }}
          />
        </View>
      ))}
    </View>
  );
}
