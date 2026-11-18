import { Button, cn, Icon, Switch, Text } from '@noteapp/ui';
import {
  FileAudioIcon,
  MicIcon,
  RefreshCwIcon,
  Share2Icon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { hasDecoder } from '@/modules/stt-native';

import { SPEECH_LEVEL } from './chunker';
import { testMicrophone } from './engine';
import {
  importAudioFile,
  listRecordings,
  type Recording,
  recordingsBytes,
  removeRecording,
} from './recordings';
import { shareFile } from './share';

// 받아쓰기 화면 아래 도구들이에요. 디자인 시스템처럼 상자 없이 위쪽 구분선으로 나눠요.

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 소리 크기 막대(0~1). 말이 들릴 만큼이면 진한 색이에요. */
export function LevelBar({ level }: { level: number }) {
  const heard = level >= SPEECH_LEVEL;
  return (
    <View
      className="h-1 overflow-hidden rounded-full bg-muted"
      accessibilityRole="progressbar"
      accessibilityLabel="마이크 소리 크기"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
    >
      <View
        className={cn('h-full rounded-full', heard ? 'bg-secondary' : 'bg-muted-foreground')}
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </View>
  );
}

/** 도구 한 줄: 아이콘, 이름, 설명, 오른쪽 요소. 누를 수 있으면 onPress */
function ToolRow({
  icon,
  label,
  hint,
  right,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={cn(
        'min-h-14 flex-row items-center gap-3 border-t border-border py-3',
        disabled && 'opacity-50',
      )}
    >
      <Icon as={icon} size={20} className="text-foreground" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] text-foreground">{label}</Text>
        {hint ? <Text className="text-[13px] leading-5 text-muted-foreground">{hint}</Text> : null}
      </View>
      {right}
    </Pressable>
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

  const testing = level !== null;
  return (
    <View>
      <ToolRow
        icon={MicIcon}
        label={testing ? '마이크 확인 끝내기' : '마이크 확인'}
        hint={
          error ??
          (testing
            ? heard
              ? '잘 들려요. 이대로 말하기를 시작하면 돼요.'
              : '아무 말이나 해 보세요. 막대가 진하게 움직이면 잘 들리는 거예요.'
            : '녹음하지 않고 소리가 잘 들어오는지만 봐요.')
        }
        onPress={() => void (testing ? stop() : startCheck())}
      />
      {testing ? (
        <View className="pb-3 pl-8">
          <LevelBar level={level} />
        </View>
      ) : null}
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
    <ToolRow
      icon={FileAudioIcon}
      label="녹음 원본 남기기"
      hint="소리를 이 기기에만 남겨서 다시 듣고, 다시 받아쓰고, 화자를 나눠요. 1시간에 약 115MB예요."
      onPress={() => onChange(!on)}
      right={
        <Switch checked={on} onCheckedChange={onChange} accessibilityLabel="녹음 원본 남기기" />
      }
    />
  );
}

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
    : `${Math.round(bytes / 1024 / 1024)}MB`;

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button variant="ghost" size="icon" onPress={onPress} accessibilityLabel={label}>
      <Icon as={icon} size={18} className="text-foreground" />
    </Button>
  );
}

/**
 * 남겨 둔 녹음 원본 목록. 지금 고른 모델로 다시 받아쓰거나, 내보내거나, 지워요.
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
    <View>
      <Text className="pb-2 pt-4 text-[13px] font-bold text-muted-foreground">
        남긴 녹음 {list.length}개, {sizeLabel(bytes)}
      </Text>
      {list.map((r) => (
        <View
          key={r.id}
          className="min-h-14 flex-row items-center gap-1 border-t border-border py-1.5"
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] text-foreground">
              {r.startedAt.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
            <Text className="text-[13px] text-muted-foreground">{clock(r.seconds)}</Text>
          </View>
          <IconButton icon={RefreshCwIcon} label="다시 받아쓰기" onPress={() => onAgain(r)} />
          <IconButton
            icon={Share2Icon}
            label="내보내기"
            onPress={() => void shareFile(r.file, 'audio/wav').catch(() => {})}
          />
          <IconButton
            icon={Trash2Icon}
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

/** 휴대폰에 있는 음성·동영상 파일을 가져와서 받아써요(Android 새 APK부터). */
export function ImportAudio({ onImported }: { onImported: (recording: Recording) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!hasDecoder()) return null;

  const pick = async () => {
    setError(null);
    setBusy(true);
    try {
      const recording = await importAudioFile();
      if (recording) onImported(recording);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolRow
      icon={FileAudioIcon}
      label={busy ? '파일을 바꾸는 중이에요' : '음성 파일 가져와서 받아쓰기'}
      hint={error ?? 'm4a, mp3, 동영상 등을 골라요. 원래 파일은 그대로예요.'}
      disabled={busy}
      onPress={() => void pick()}
    />
  );
}
