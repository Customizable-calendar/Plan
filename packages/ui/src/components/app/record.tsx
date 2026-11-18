import { CardListRow } from '../../components/app/cards';
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import type { CardType } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import {
  BookmarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  LocateFixedIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilLineIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SparklesIcon,
  SquareIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

// 녹음, 받아쓴 글, AI 요약에 쓰는 컴포넌트예요.
// 앱에서 더한 것: RecordPanel onCancel·onFinish, RecordMiniBar onFinish, PlayerBar onBack·onForward·onSpeed·onLocate (모양은 그대로)
// 구조는 docs/benchmark/README.md 의 "받아쓰기" 항목을 따라요.

const BARS = [
  6, 12, 20, 9, 26, 14, 30, 18, 8, 22, 34, 16, 10, 28, 20, 12, 24, 8, 18, 30, 14, 22, 10, 26, 16, 8,
  20, 12,
];

/** 녹음 파형. 멈추면 회색으로 바뀌어요 */
export function Waveform({ paused = false, height = 40 }: { paused?: boolean; height?: number }) {
  return (
    <View className="flex-row items-center justify-center gap-[3px]" style={{ height }}>
      {BARS.map((h, i) => (
        <View
          key={i}
          className={cn('w-[3px] rounded-full', paused ? 'bg-border' : 'bg-secondary')}
          style={{ height: Math.max(4, (h / 34) * height) }}
        />
      ))}
    </View>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
  tone = 'plain',
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  tone?: 'plain' | 'main';
}) {
  return (
    <Pressable onPress={onPress} className="items-center gap-1.5" accessibilityLabel={label}>
      <View
        className={cn(
          'items-center justify-center rounded-full',
          tone === 'main'
            ? 'h-16 w-16 bg-secondary'
            : 'h-12 w-12 border border-border bg-background',
        )}
      >
        <Icon
          as={icon}
          size={tone === 'main' ? 26 : 20}
          className={tone === 'main' ? 'text-secondary-foreground' : 'text-foreground'}
        />
      </View>
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

/** 녹음 시트 안쪽. BottomSheet 안에 넣어 써요. 끌어내리면 RecordMiniBar 로 줄어요 */
export function RecordPanel({
  time,
  paused = false,
  bookmarks = 0,
  preview,
  onPause,
  onBookmark,
  onMemo,
  onCancel,
  onFinish,
}: {
  time: string;
  paused?: boolean;
  bookmarks?: number;
  /** 지금 받아쓰고 있는 글. 아직 확정 안 된 글은 회색이에요 */
  preview?: { done: string; pending?: string };
  onPause?: () => void;
  onBookmark?: () => void;
  onMemo?: () => void;
  /** 앱에서 더함: 맨 위 "취소", "끝내기"를 누를 때 */
  onCancel?: () => void;
  onFinish?: () => void;
}) {
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
          <Text className="text-sm text-muted-foreground">취소</Text>
        </Pressable>
        <View className="flex-row items-center gap-1.5">
          <View
            className={cn('h-2 w-2 rounded-full', paused ? 'bg-muted-foreground' : 'bg-secondary')}
          />
          <Text className="text-[13px] font-bold text-foreground">
            {paused ? '잠시 멈춤' : '한국어 받아쓰는 중'}
          </Text>
        </View>
        <Pressable onPress={onFinish} accessibilityRole="button" hitSlop={8}>
          <Text className="text-sm font-bold text-primary">끝내기</Text>
        </Pressable>
      </View>
      <View className="items-center gap-2">
        <Text className="text-[40px] font-bold tracking-tight text-foreground">{time}</Text>
        <Waveform paused={paused} />
      </View>
      {preview ? (
        <View className="rounded-lg bg-muted px-3.5 py-3">
          <Text className="text-[15px] leading-6 text-foreground">
            {preview.done}
            {preview.pending ? (
              <Text className="text-[15px] text-muted-foreground"> {preview.pending}</Text>
            ) : null}
          </Text>
        </View>
      ) : null}
      <View className="flex-row items-end justify-around">
        <RoundAction
          icon={BookmarkIcon}
          label={bookmarks ? `북마크 ${bookmarks}` : '북마크'}
          onPress={onBookmark}
        />
        <RoundAction
          icon={paused ? PlayIcon : PauseIcon}
          label={paused ? '이어서' : '잠시 멈춤'}
          tone="main"
          onPress={onPause}
        />
        <RoundAction icon={PencilLineIcon} label="메모" onPress={onMemo} />
      </View>
    </View>
  );
}

/** 줄여 놓은 녹음 막대. 탭바 위에 떠 있고, 누르면 시트가 다시 열려요 */
export function RecordMiniBar({
  time,
  paused = false,
  onOpen,
  onBookmark,
  onFinish,
}: {
  time: string;
  paused?: boolean;
  onOpen?: () => void;
  onBookmark?: () => void;
  /** 앱에서 더함: 오른쪽 네모(끝내기)를 누를 때 */
  onFinish?: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      className="h-14 flex-row items-center gap-3 rounded-xl border border-border bg-popover px-3.5 shadow-lg shadow-black/15"
    >
      <View
        className={cn('h-2.5 w-2.5 rounded-full', paused ? 'bg-muted-foreground' : 'bg-secondary')}
      />
      <Text className="text-[15px] font-bold text-popover-foreground">{time}</Text>
      <View className="flex-1">
        <Waveform paused={paused} height={20} />
      </View>
      <Pressable
        onPress={onBookmark}
        className="h-9 w-9 items-center justify-center"
        accessibilityLabel="북마크"
      >
        <Icon as={BookmarkIcon} size={19} className="text-foreground" />
      </Pressable>
      <Pressable
        onPress={onFinish}
        accessibilityLabel="끝내기"
        className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
      >
        <Icon as={SquareIcon} size={14} className="text-secondary-foreground" />
      </Pressable>
    </Pressable>
  );
}

/** 탭 이름 옆에 개수를 붙일 수 있는 탭. 노트 안 검색 결과 수를 여기에 보여 줘요 */
export function CountTabs({
  items,
  active,
  onChange,
}: {
  items: { key: string; label: string; count?: number }[];
  active: string;
  onChange?: (key: string) => void;
}) {
  return (
    <View className="flex-row border-b border-border px-5">
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange?.(it.key)}
            className="mr-5 h-11 justify-center"
          >
            <View className="flex-row items-center gap-1">
              <Text
                className={cn(
                  'text-[15px]',
                  on ? 'font-bold text-foreground' : 'text-muted-foreground',
                )}
              >
                {it.label}
              </Text>
              {it.count !== undefined ? (
                <Text
                  className={cn(
                    'text-[13px] font-bold',
                    on ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {it.count}
                </Text>
              ) : null}
            </View>
            {on ? (
              <View className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type TranscriptWord = { text: string; highlight?: boolean };

/** 받아쓴 글 한 구간. 단어를 누르면 그 자리부터 재생하고, 길게 누르면 동작 시트가 열려요 */
export function TranscriptBlock({
  time,
  words,
  playingIndex,
  bookmarked = false,
  memo,
  selected = false,
  onWordPress,
  onLongPress,
}: {
  time: string;
  words: TranscriptWord[];
  /** 지금 재생 중인 단어 */
  playingIndex?: number;
  bookmarked?: boolean;
  /** 녹음 중에 적은 메모 */
  memo?: string;
  selected?: boolean;
  onWordPress?: (index: number) => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      className={cn('gap-1.5 rounded-lg px-3 py-2.5', selected && 'bg-accent')}
    >
      <View className="flex-row items-center gap-1.5">
        <Text className="text-xs font-bold text-muted-foreground">{time}</Text>
        {bookmarked ? <Icon as={BookmarkIcon} size={13} className="text-secondary" /> : null}
      </View>
      <View className="flex-row flex-wrap">
        {words.map((w, i) => (
          <Pressable key={i} onPress={() => onWordPress?.(i)}>
            <Text
              className={cn(
                'text-base leading-7 text-foreground',
                w.highlight && 'bg-idea-soft',
                i === playingIndex &&
                  'rounded bg-primary-soft font-bold text-primary-soft-foreground',
              )}
            >
              {w.text}{' '}
            </Text>
          </Pressable>
        ))}
      </View>
      {memo ? (
        <View className="flex-row items-start gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
          <Icon as={PencilLineIcon} size={13} className="mt-0.5 text-muted-foreground" />
          <Text className="flex-1 text-[13px] text-muted-foreground">{memo}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const SPEEDS = ['1.0', '1.2', '1.5', '2.0', '0.8'];

/** 재생 막대. 글을 스크롤해서 재생 위치가 안 보이면 "재생 위치로"가 나와요 */
export function PlayerBar({
  current,
  total,
  progress,
  playing = false,
  showLocate = false,
  onToggle,
  onBack,
  onForward,
  onSpeed,
  onLocate,
}: {
  current: string;
  total: string;
  /** 0~1 */
  progress: number;
  playing?: boolean;
  showLocate?: boolean;
  onToggle?: () => void;
  /** 앱에서 더함: 5초 뒤로, 5초 앞으로, 속도 바꾸기(1.0 같은 배속), 재생 위치로 */
  onBack?: () => void;
  onForward?: () => void;
  onSpeed?: (rate: number) => void;
  onLocate?: () => void;
}) {
  const [speed, setSpeed] = React.useState(0);
  return (
    <View className="gap-2 border-t border-border bg-background px-5 pb-3 pt-2.5">
      {showLocate ? (
        <Pressable onPress={onLocate} className="absolute -top-11 self-center">
          <View className="h-9 flex-row items-center gap-1.5 rounded-full bg-foreground px-3.5 shadow-lg shadow-black/20">
            <Icon as={LocateFixedIcon} size={14} className="text-background" />
            <Text className="text-[13px] font-bold text-background">재생 위치로</Text>
          </View>
        </Pressable>
      ) : null}
      <View className="h-1 overflow-hidden rounded-full bg-muted">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="w-[84px] text-xs text-muted-foreground">
          {current} / {total}
        </Text>
        <View className="flex-row items-center gap-5">
          <Pressable onPress={onBack} accessibilityLabel="5초 뒤로" className="items-center">
            <Icon as={RotateCcwIcon} size={22} className="text-foreground" />
            <Text className="text-[10px] text-muted-foreground">5초</Text>
          </Pressable>
          <Pressable
            onPress={onToggle}
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
          >
            <Icon
              as={playing ? PauseIcon : PlayIcon}
              size={20}
              className="text-primary-foreground"
            />
          </Pressable>
          <Pressable onPress={onForward} accessibilityLabel="5초 앞으로" className="items-center">
            <Icon as={RotateCwIcon} size={22} className="text-foreground" />
            <Text className="text-[10px] text-muted-foreground">5초</Text>
          </Pressable>
        </View>
        <View className="w-[84px] items-end">
          <Pressable
            onPress={() => {
              const next = (speed + 1) % SPEEDS.length;
              setSpeed(next);
              onSpeed?.(Number(SPEEDS[next]));
            }}
            className="h-8 w-12 items-center justify-center rounded-md border border-border"
          >
            <Text className="text-xs font-bold text-foreground">{SPEEDS[speed]}x</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** 요약의 한 구역. 상자 없이 위쪽 구분선과 제목 줄만 써요. 제목을 누르면 접혀요 */
export function SummarySection({
  title,
  edited = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  edited?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <View className="border-t border-border">
      <Pressable onPress={() => setOpen((o) => !o)} className="h-12 flex-row items-center gap-2">
        <Text className="flex-1 text-[17px] font-bold text-foreground">{title}</Text>
        {edited ? <Text className="text-xs text-muted-foreground">고침</Text> : null}
        <Icon
          as={open ? ChevronUpIcon : ChevronDownIcon}
          size={18}
          className="text-muted-foreground"
        />
      </Pressable>
      {open ? <View className="gap-2 pb-4">{children}</View> : null}
    </View>
  );
}

/** 요약 본문의 글머리 줄 */
export function SummaryLine({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2">
      <View className="mt-[9px] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      <Text className="flex-1 text-[15px] leading-6 text-foreground">{children}</Text>
    </View>
  );
}

export type NextAction = {
  type: CardType;
  title: string;
  meta?: string;
  state?: 'suggested' | 'confirmed';
};

/** 요약의 "다음 할 일". 글 목록이 아니라 카드 후보예요. 오늘 카드와 같은 줄 모양이고, 확인해야 저장돼요 */
export function NextActionRow({
  action,
  onConfirm,
}: {
  action: NextAction;
  onConfirm?: () => void;
}) {
  return (
    <CardListRow
      type={action.type}
      title={action.title}
      meta={action.meta}
      state={action.state === 'confirmed' ? 'confirmed' : 'suggested'}
      onConfirm={onConfirm}
    />
  );
}

/** AI 결과 아래에 붙이는 안내 */
export function AiNotice({
  children = 'AI가 정리한 내용이라 틀릴 수 있어요. 원문과 같이 확인해 주세요.',
}: {
  children?: string;
}) {
  return (
    <View className="flex-row items-start gap-1.5">
      <Icon as={InfoIcon} size={13} className="mt-0.5 text-muted-foreground" />
      <Text className="flex-1 text-xs text-muted-foreground">{children}</Text>
    </View>
  );
}

/** 요약 맨 위의 양식 줄. 어떤 양식으로 정리했는지 보여 주고 다시 만들 수 있어요 */
export function SummaryHeader({ template, left }: { template: string; left?: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon as={SparklesIcon} size={15} className="text-ai" />
      <Text className="text-[13px] font-bold text-ai">AI 요약</Text>
      <View className="flex-row items-center gap-0.5">
        <Text className="text-[13px] text-foreground">{template}</Text>
        <Icon as={ChevronDownIcon} size={14} className="text-muted-foreground" />
      </View>
      <View className="flex-1" />
      {left ? <Text className="text-xs text-muted-foreground">{left}</Text> : null}
      <Icon as={MoreHorizontalIcon} size={18} className="text-muted-foreground" />
    </View>
  );
}

/** 길게 눌렀을 때 시트에 모아 보여 주는 동작 한 줄 */
export function ActionRow({
  icon,
  label,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <View className="h-12 flex-row items-center gap-3">
      <Icon as={icon} size={20} className="text-popover-foreground" />
      <Text className="flex-1 text-[15px] text-popover-foreground">{label}</Text>
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
