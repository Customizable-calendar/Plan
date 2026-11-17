import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { DEFAULT_STATE, type CalendarDesign } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import {
  AlertTriangleIcon,
  CheckIcon,
  CloudUploadIcon,
  RefreshCwIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** 실제 앱에서는 lib/theme.ts 의 CALENDAR_DESIGN 을 넣는다 */
export const CalendarDesignContext = React.createContext<CalendarDesign>(DEFAULT_STATE.calendar);

export type Account = 1 | 2;

// NativeWind 는 클래스 이름을 정적으로 읽으므로 조합하지 않고 그대로 적는다
const ACC = {
  1: {
    soft: 'bg-cal-1-soft',
    fill: 'bg-cal-1',
    bar: 'border-l-[3px] border-l-cal-1',
    text: 'text-cal-1',
    dot: 'bg-cal-1',
  },
  2: {
    soft: 'bg-cal-2-soft',
    fill: 'bg-cal-2',
    bar: 'border-l-[3px] border-l-cal-2',
    text: 'text-cal-2',
    dot: 'bg-cal-2',
  },
} as const;

export function AccountDot({ account }: { account: Account }) {
  return <View className={cn('h-2 w-2 rounded-full', ACC[account].dot)} />;
}

/** 연결한 캘린더 계정 칩. 눌러서 보기/숨기기 */
export function AccountChip({
  account,
  label,
  off = false,
  onPress,
}: {
  account: Account;
  label: string;
  off?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1',
        off ? 'border border-border bg-background' : ACC[account].soft,
      )}
    >
      {off ? (
        <View className="h-2 w-2 rounded-full border border-muted-foreground" />
      ) : (
        <AccountDot account={account} />
      )}
      <Text
        className={cn(
          'text-xs font-bold',
          off ? 'text-muted-foreground line-through' : ACC[account].text,
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export type SyncState = 'ok' | 'syncing' | 'partial' | 'reauth' | 'pending';

const SYNC: Record<
  SyncState,
  { icon: LucideIcon; text: string; action?: string; tone: 'muted' | 'warn' | 'info' }
> = {
  ok: { icon: CheckIcon, text: '모두 동기화됨 · 2분 전', tone: 'muted' },
  syncing: { icon: RefreshCwIcon, text: '일정을 가져오는 중이에요', tone: 'muted' },
  partial: {
    icon: AlertTriangleIcon,
    text: '일부 일정을 못 가져왔어요',
    action: '다시 시도',
    tone: 'warn',
  },
  reauth: {
    icon: AlertTriangleIcon,
    text: '회사 계정에 다시 로그인해야 해요',
    action: '로그인',
    tone: 'warn',
  },
  pending: { icon: CloudUploadIcon, text: 'Google에 저장 대기 1건', action: '보기', tone: 'info' },
};

/** 동기화 상태 한 줄. 문제가 있을 때만 서브(경고) 색 */
export function SyncBanner({ state, text }: { state: SyncState; text?: string }) {
  const s = SYNC[state];
  return (
    <View
      className={cn(
        'flex-row items-center gap-2 rounded-lg px-3 py-2',
        s.tone === 'warn' && 'bg-secondary-soft',
        s.tone === 'info' && 'bg-primary-soft',
        s.tone === 'muted' && 'bg-muted',
      )}
    >
      <Icon
        as={s.icon}
        size={14}
        className={cn(
          s.tone === 'warn' && 'text-secondary-soft-foreground',
          s.tone === 'info' && 'text-primary-soft-foreground',
          s.tone === 'muted' && 'text-muted-foreground',
        )}
      />
      <Text
        className={cn(
          'flex-1 text-xs',
          s.tone === 'warn' && 'text-secondary-soft-foreground',
          s.tone === 'info' && 'text-primary-soft-foreground',
          s.tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {text ?? s.text}
      </Text>
      {s.action ? (
        <Text
          className={cn(
            'text-xs font-bold',
            s.tone === 'warn' ? 'text-secondary-soft-foreground' : 'text-primary-soft-foreground',
          )}
        >
          {s.action}
        </Text>
      ) : null}
    </View>
  );
}

export type WeekDay = { label: string; date: number; accounts?: Account[] };

/** 일 보기 위의 한 주 날짜 줄. 점은 그날 일정이 있는 계정 */
export function WeekStrip({
  days,
  selected,
  onSelect,
}: {
  days: WeekDay[];
  selected: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <View className="flex-row gap-1">
      {days.map((d, i) => {
        const on = i === selected;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect?.(i)}
            className={cn('flex-1 items-center gap-0.5 rounded-lg py-1.5', on && 'bg-primary')}
          >
            <Text
              className={cn(
                'text-[11px]',
                on ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {d.label}
            </Text>
            <Text
              className={cn(
                'text-[15px] font-bold',
                on ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {d.date}
            </Text>
            <View className="h-1.5 flex-row gap-0.5">
              {(d.accounts ?? []).map((a) =>
                on ? (
                  <View key={a} className="h-1 w-1 rounded-full bg-primary-foreground" />
                ) : (
                  <View key={a} className={cn('h-1 w-1 rounded-full', ACC[a].dot)} />
                ),
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 일정 블록. account 가 없으면 AI 후보(아직 저장 안 됨) */
export function EventBlock({
  account,
  title,
  meta,
  className,
  style,
}: {
  account?: Account;
  title: string;
  meta?: string;
  className?: string;
  style?: object;
}) {
  const cal = React.useContext(CalendarDesignContext);
  if (!account) {
    return (
      <View
        style={style}
        className={cn(
          'gap-0.5 overflow-hidden rounded-md px-2.5 py-1.5',
          cal.suggestion === 'dashed'
            ? 'border-[1.5px] border-dashed border-ai bg-ai-soft/40'
            : 'bg-ai-soft',
          className,
        )}
      >
        <View className="flex-row items-center gap-1">
          <Icon as={SparklesIcon} size={12} className="text-ai" />
          <Text className="text-[13px] font-bold text-ai">{title}</Text>
        </View>
        {meta ? <Text className="text-[11px] text-ai">{meta}</Text> : null}
      </View>
    );
  }
  const fill = cal.eventStyle === 'fill';
  return (
    <View
      style={style}
      className={cn(
        'gap-0.5 overflow-hidden rounded-md px-2.5 py-1.5',
        fill ? ACC[account].fill : [ACC[account].soft, ACC[account].bar],
        className,
      )}
    >
      <Text className={cn('text-[13px] font-bold', fill ? 'text-background' : 'text-foreground')}>
        {title}
      </Text>
      {meta ? (
        <Text className={cn('text-[11px]', fill ? 'text-background' : 'text-muted-foreground')}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

export type TimelineEvent = {
  account?: Account;
  title: string;
  meta?: string;
  start: number;
  end: number;
};

export function useHourHeight() {
  const cal = React.useContext(CalendarDesignContext);
  return cal.density === 'compact' ? 44 : 64;
}

/** 하루 시간표. start/end 는 시(9.5 = 9:30) */
export function DayTimeline({
  from,
  to,
  events,
}: {
  from: number;
  to: number;
  events: TimelineEvent[];
}) {
  const h = useHourHeight();
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <View style={{ height: (to - from) * h + 8 }} className="relative">
      {hours.map((hr) => (
        <View
          key={hr}
          className="absolute left-0 right-0 flex-row items-center gap-2"
          style={{ top: (hr - from) * h - 7 }}
        >
          <Text className="w-10 text-[11px] text-muted-foreground">{`${String(hr).padStart(2, '0')}:00`}</Text>
          <View className="h-px flex-1 bg-border" />
        </View>
      ))}
      {events.map((e) => (
        <EventBlock
          key={e.title}
          account={e.account}
          title={e.title}
          meta={e.meta}
          className="absolute right-0"
          style={{ left: 48, top: (e.start - from) * h + 2, height: (e.end - e.start) * h - 4 }}
        />
      ))}
    </View>
  );
}

export type Fit = 'good' | 'ok' | 'tight';
const FIT_WORD: Record<Fit, string> = { good: '잘 맞음', ok: '보통', tight: '여유 적음' };

/** 시간 후보 하나. 고른 것만 저장되므로 라디오처럼 동작 */
export function SlotOption({
  time,
  fit,
  score,
  reason,
  selected = false,
  onPress,
}: {
  time: string;
  fit: Fit;
  score: number;
  reason: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const cal = React.useContext(CalendarDesignContext);
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row gap-3 rounded-lg px-3.5 py-3',
        selected ? 'border-2 border-primary bg-primary-soft/40' : 'border border-border bg-card',
      )}
    >
      <View
        className={cn(
          'mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-full border-2',
          selected ? 'border-primary' : 'border-input',
        )}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-[15px] font-bold text-card-foreground">{time}</Text>
          {cal.fitLabel === 'word' ? (
            <View
              className={cn(
                'rounded-full px-2 py-0.5',
                fit === 'good' && 'bg-primary-soft',
                fit === 'ok' && 'bg-muted',
                fit === 'tight' && 'bg-secondary-soft',
              )}
            >
              <Text
                className={cn(
                  'text-[11px] font-bold',
                  fit === 'good' && 'text-primary-soft-foreground',
                  fit === 'ok' && 'text-muted-foreground',
                  fit === 'tight' && 'text-secondary-soft-foreground',
                )}
              >
                {FIT_WORD[fit]}
              </Text>
            </View>
          ) : null}
          {cal.fitLabel === 'score' ? (
            <Text className="text-xs text-muted-foreground">
              적합 <Text className="text-[13px] font-bold text-foreground">{score}</Text>
            </Text>
          ) : null}
        </View>
        {cal.showReasons ? (
          <Text className="text-xs leading-[18px] text-muted-foreground">{reason}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export type Status = 'done' | 'partial' | 'missed' | 'unknown';
export const STATUS_LABEL: Record<Status, string> = {
  done: '완료',
  partial: '부분',
  missed: '못 함',
  unknown: '모름',
};
const STATUS_ORDER: Status[] = ['done', 'partial', 'missed', 'unknown'];

/** 수행 확인 4가지. 못 함도 오류가 아니므로 빨강 대신 서브 연한 면 */
export function StatusPicker({
  value,
  onChange,
}: {
  value?: Status;
  onChange?: (s: Status) => void;
}) {
  const cal = React.useContext(CalendarDesignContext);
  const chip = cal.statusStyle === 'chip';
  return (
    <View className={cn('flex-row gap-1.5', chip && 'flex-wrap')}>
      {STATUS_ORDER.map((s) => {
        const on = s === value;
        return (
          <Pressable
            key={s}
            onPress={() => onChange?.(s)}
            className={cn(
              'items-center justify-center border',
              chip ? 'h-8 rounded-full px-3.5' : 'h-9 flex-1 rounded-md',
              !on && 'border-border bg-background',
              on && s === 'done' && 'border-primary bg-primary',
              on && s === 'partial' && 'border-primary/40 bg-primary-soft',
              on && s === 'missed' && 'border-secondary/40 bg-secondary-soft',
              on && s === 'unknown' && 'border-input bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-[13px] font-bold',
                !on && 'text-muted-foreground',
                on && s === 'done' && 'text-primary-foreground',
                on && s === 'partial' && 'text-primary-soft-foreground',
                on && s === 'missed' && 'text-secondary-soft-foreground',
                on && s === 'unknown' && 'text-foreground',
              )}
            >
              {STATUS_LABEL[s]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const FOLLOW_UP: Partial<Record<Status, { label: string; options: string[] }>> = {
  partial: { label: '얼마나?', options: ['절반쯤', '거의 다', '1시간 더 필요'] },
  missed: { label: '이유', options: ['회의가 길어짐', '급한 일', '컨디션'] },
};

/** 수행 확인 한 줄: 제목 + 4가지 + (부분·못 함일 때) 한 번 더 묻기 */
export function CheckItem({
  title,
  meta,
  initial,
  initialFollow,
}: {
  title: string;
  meta: string;
  initial?: Status;
  initialFollow?: string;
}) {
  const [value, setValue] = React.useState<Status | undefined>(initial);
  const [follow, setFollow] = React.useState<string | undefined>(initialFollow);
  const fu = value ? FOLLOW_UP[value] : undefined;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{meta}</Text>
      </View>
      <StatusPicker value={value} onChange={setValue} />
      {fu ? (
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="text-xs text-muted-foreground">{fu.label}</Text>
          {fu.options.map((o) => (
            <Pressable
              key={o}
              onPress={() => setFollow(o)}
              className={cn(
                'rounded-full px-2.5 py-1',
                follow === o ? 'bg-foreground' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-[11px] font-bold',
                  follow === o ? 'text-background' : 'text-foreground',
                )}
              >
                {o}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 완료 · 부분 · 못 함 비율 막대 */
export function CompletionBar({
  done,
  partial,
  missed,
}: {
  done: number;
  partial: number;
  missed: number;
}) {
  return (
    <View className="gap-1.5">
      <View className="h-3 flex-row overflow-hidden rounded-full bg-muted">
        <View className="bg-primary" style={{ flex: done }} />
        <View className="bg-primary/40" style={{ flex: partial }} />
        <View className="bg-secondary/60" style={{ flex: missed }} />
      </View>
      <View className="flex-row gap-3">
        {[
          ['bg-primary', `완료 ${done}`],
          ['bg-primary/40', `부분 ${partial}`],
          ['bg-secondary/60', `못 함 ${missed}`],
        ].map(([c, l]) => (
          <View key={l} className="flex-row items-center gap-1">
            <View className={cn('h-2 w-2 rounded-full', c)} />
            <Text className="text-xs text-muted-foreground">{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 gap-0.5 rounded-lg border border-border bg-card px-3.5 py-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text
        className={cn('text-[22px] font-bold', accent ? 'text-primary' : 'text-card-foreground')}
      >
        {value}
      </Text>
    </View>
  );
}
