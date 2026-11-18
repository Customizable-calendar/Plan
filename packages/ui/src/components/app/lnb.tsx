import { NavDesignContext } from '../../components/app/navigation';
import { TreeRow } from '../../components/app/tree';
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import type { CardType } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import {
  AlignLeftIcon,
  ArchiveIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  LayoutTemplateIcon,
  MicIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

export type LnbKey =
  | 'home'
  | 'calendar'
  | 'cards'
  | 'feed'
  | 'search'
  | 'capture'
  | 'record'
  | 'ask'
  | `session:${string}`
  | `card:${CardType}`
  | 'pending'
  | 'people'
  | 'archive'
  | 'settings';

const TYPE_DOT: Record<CardType, string> = {
  event: 'bg-event',
  task: 'bg-task',
  person: 'bg-person',
  idea: 'bg-idea',
};

export function LnbSection({
  title,
  action,
  children,
}: {
  title?: string;
  action?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-0.5 border-t border-border px-3 py-2.5 first:border-t-0">
      {title ? (
        <View className="flex-row items-center justify-between px-2 pb-1 pt-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">{title}</Text>
          {action ? <Icon as={action} size={16} className="text-muted-foreground" /> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** LNB 한 줄. 선택 표시는 NAV_DESIGN.selected (연한 면 / 왼쪽 막대) */
export function LnbItem({
  icon,
  dot,
  label,
  count,
  emphasis,
  active,
  ai,
}: {
  icon?: LucideIcon;
  dot?: CardType;
  label: string;
  count?: number;
  /** 확인 대기처럼 눈에 띄어야 하는 개수 */
  emphasis?: boolean;
  active?: boolean;
  ai?: boolean;
}) {
  const nav = React.useContext(NavDesignContext);
  const compact = nav.density === 'compact';
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-md px-2',
        compact ? 'h-9' : 'h-11',
        active && nav.selected === 'soft' && 'bg-primary-soft',
      )}
    >
      {active && nav.selected === 'bar' ? (
        <View className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-primary" />
      ) : null}
      {dot ? (
        <View className="w-5 items-center">
          <View className={cn('h-2.5 w-2.5 rounded-full', TYPE_DOT[dot])} />
        </View>
      ) : icon ? (
        <Icon
          as={icon}
          size={19}
          className={active ? 'text-primary' : ai ? 'text-ai' : 'text-muted-foreground'}
        />
      ) : (
        <View className="w-5" />
      )}
      <Text
        className={cn(
          'flex-1 text-[15px]',
          active ? 'font-bold text-primary-soft-foreground' : 'text-foreground',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== undefined ? (
        emphasis ? (
          <View className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
            <Text className="text-[11px] font-bold text-primary-foreground">{count}</Text>
          </View>
        ) : (
          <Text className="text-xs text-muted-foreground">{count}</Text>
        )
      ) : null}
    </View>
  );
}

/** 캘린더별로 켜고 끄는 줄. 끄면 그 캘린더 일정이 달력과 홈에서 빠져요 */
export function LnbToggle({
  color,
  label,
  on = true,
}: {
  color: 'cal-1' | 'cal-2' | 'ai';
  label: string;
  on?: boolean;
}) {
  const [value, setValue] = React.useState(on);
  const fill =
    color === 'cal-1'
      ? 'bg-cal-1 border-cal-1'
      : color === 'cal-2'
        ? 'bg-cal-2 border-cal-2'
        : 'bg-ai border-ai';
  const line =
    color === 'cal-1' ? 'border-cal-1' : color === 'cal-2' ? 'border-cal-2' : 'border-ai';
  return (
    <Pressable
      onPress={() => setValue((v) => !v)}
      className="h-11 flex-row items-center gap-3 rounded-md px-2"
    >
      <View className="w-5 items-center">
        <View
          className={cn(
            'h-4 w-4 items-center justify-center rounded border-2',
            value ? fill : line,
          )}
        >
          {value ? <Icon as={CheckIcon} size={11} className="text-background" /> : null}
        </View>
      </View>
      <Text
        className={cn('flex-1 text-[15px]', value ? 'text-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LnbProfile() {
  return (
    <View className="flex-row items-center gap-3 px-5 pb-3 pt-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        <Text className="font-bold text-primary-soft-foreground">서</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-foreground">서현</Text>
        <Text className="text-xs text-muted-foreground">개인 공간</Text>
      </View>
      <Icon as={ChevronsUpDownIcon} size={18} className="text-muted-foreground" />
    </View>
  );
}

export function UsageMeter({ percent = 31 }: { percent?: number }) {
  const tone = percent >= 100 ? 'bg-destructive' : percent >= 80 ? 'bg-secondary' : 'bg-primary';
  return (
    <View className="gap-1.5 px-5 py-3">
      <View className="flex-row justify-between">
        <Text className="text-xs text-muted-foreground">이번 달 AI 사용량</Text>
        <Text className="text-xs font-bold text-foreground">{percent}%</Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View
          className={cn('h-full rounded-full', tone)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </View>
    </View>
  );
}

const SESSIONS: { id: string; label: string; icon: LucideIcon; count: number; docs: string[] }[] = [
  {
    id: 'worklog',
    label: '업무일지',
    icon: LayoutTemplateIcon,
    count: 12,
    docs: ['업무일지 10/24', '업무일지 10/23'],
  },
  { id: 'blog', label: '블로그', icon: ImageIcon, count: 4, docs: ['가을 카페 투어 3곳'] },
  {
    id: 'minutes',
    label: '회의록',
    icon: AlignLeftIcon,
    count: 7,
    docs: ['주간 회의 10/24', '기획 회의 10/21'],
  },
  { id: 'paper', label: '연구논문', icon: FileTextIcon, count: 1, docs: ['추천 시스템 정리'] },
];

/** 세션을 자료함과 같은 펼치는 목록으로 보여 줘요. 양식을 누르면 최근 문서가 펼쳐져요 */
function LnbTree({ active }: { active?: LnbKey }) {
  const [open, setOpen] = React.useState<string[]>(['worklog']);
  return (
    <View>
      {SESSIONS.map((s) => {
        const on = open.includes(s.id);
        return (
          <View key={s.id}>
            <TreeRow
              icon={s.icon}
              label={s.label}
              count={s.count}
              expanded={on}
              selected={active === `session:${s.id}` && !on}
              onPress={() => setOpen((l) => (on ? l.filter((x) => x !== s.id) : [...l, s.id]))}
            />
            {on
              ? s.docs.map((d, i) => (
                  <TreeRow
                    key={d}
                    icon={FileTextIcon}
                    label={d}
                    depth={1}
                    selected={active === `session:${s.id}` && i === 0}
                    status={i === 0 && s.id === 'worklog' ? '고치는 중' : undefined}
                  />
                ))
              : null}
          </View>
        );
      })}
      <TreeRow icon={FolderIcon} label="자료함 전체" />
    </View>
  );
}

/**
 * LNB 메뉴.
 * - drawer: 휴대폰에서 왼쪽에서 밀어 여는 메뉴 (하단 탭바와 같이 씀)
 * - sidebar: 태블릿·웹에서 항상 보이는 메뉴 (하단 탭바 대신 주 메뉴까지 포함)
 */
export function Lnb({
  variant = 'drawer',
  active = 'session:worklog',
  usage = 31,
}: {
  variant?: 'drawer' | 'sidebar';
  active?: LnbKey;
  usage?: number;
}) {
  const nav = React.useContext(NavDesignContext);
  const showSessions = variant === 'sidebar' || nav.tabs === 'lnb4';
  return (
    <View
      className={cn(
        'h-full bg-background',
        variant === 'drawer'
          ? 'w-[300px] shadow-2xl shadow-black/30'
          : 'w-[260px] border-r border-border',
      )}
    >
      <LnbProfile />
      <ScrollView className="flex-1">
        {variant === 'sidebar' ? (
          <LnbSection>
            <LnbItem icon={HomeIcon} label="홈" active={active === 'home'} />
            <LnbItem icon={LayersIcon} label="오늘 카드" active={active === 'cards'} />
            <LnbItem icon={CalendarDaysIcon} label="캘린더" active={active === 'calendar'} />
            <LnbItem icon={UsersIcon} label="피드" active={active === 'feed'} />
            <LnbItem icon={SearchIcon} label="검색" active={active === 'search'} />
          </LnbSection>
        ) : null}
        {nav.showQuick ? (
          <LnbSection title="빠른 실행">
            <LnbItem icon={PencilLineIcon} label="빠른 입력" active={active === 'capture'} />
            <LnbItem icon={MicIcon} label="녹음" active={active === 'record'} />
            <LnbItem icon={SparklesIcon} label="AI에게 묻기" ai active={active === 'ask'} />
            {variant === 'drawer' && nav.tabs !== 'calendar' ? (
              <LnbItem icon={CalendarDaysIcon} label="캘린더" active={active === 'calendar'} />
            ) : null}
          </LnbSection>
        ) : null}
        {showSessions ? (
          <LnbSection title="세션" action={PlusIcon}>
            <LnbTree active={active} />
          </LnbSection>
        ) : (
          <LnbSection>
            <LnbItem icon={FolderIcon} label="세션은 하단 탭에서" />
          </LnbSection>
        )}
        {nav.showCards ? (
          <LnbSection title="카드">
            <LnbItem dot="event" label="일정" count={3} active={active === 'card:event'} />
            <LnbItem dot="task" label="할 일" count={2} active={active === 'card:task'} />
            <LnbItem dot="person" label="사람" count={5} active={active === 'card:person'} />
            <LnbItem dot="idea" label="아이디어" count={1} active={active === 'card:idea'} />
            <LnbItem label="확인 대기" count={2} emphasis active={active === 'pending'} />
          </LnbSection>
        ) : null}
        {nav.tabs !== 'calendar' ? (
          <LnbSection title="캘린더">
            <LnbToggle color="cal-1" label="회사" />
            <LnbToggle color="cal-2" label="개인" />
            <LnbToggle color="ai" label="AI 후보" />
          </LnbSection>
        ) : null}
        <LnbSection>
          <LnbItem icon={UserRoundIcon} label="사람 목록" active={active === 'people'} />
          <LnbItem icon={ArchiveIcon} label="보관함" active={active === 'archive'} />
          <LnbItem icon={SettingsIcon} label="설정" active={active === 'settings'} />
        </LnbSection>
      </ScrollView>
      {nav.showUsage ? (
        <View className="border-t border-border">
          <UsageMeter percent={usage} />
        </View>
      ) : null}
    </View>
  );
}
