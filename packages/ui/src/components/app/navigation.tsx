import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { DEFAULT_STATE, type NavDesign, type TabLayout } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  FolderIcon,
  HomeIcon,
  ArrowUpDownIcon,
  LayersIcon,
  MenuIcon,
  SearchIcon,
  XIcon,
  ZapIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

export type TabKey = 'home' | 'cards' | 'calendar' | 'sessions' | 'feed' | 'search';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: '홈', icon: HomeIcon },
  { key: 'cards', label: '카드', icon: LayersIcon },
  { key: 'calendar', label: '캘린더', icon: CalendarDaysIcon },
  { key: 'sessions', label: '세션', icon: FolderIcon },
  { key: 'feed', label: '피드', icon: UsersIcon },
  { key: 'search', label: '검색', icon: SearchIcon },
];

/** 실제 앱에서는 lib/theme.ts 의 NAV_DESIGN 을 넣는다 */
export const NavDesignContext = React.createContext<NavDesign>(DEFAULT_STATE.nav);

const LAYOUT_TABS: Record<TabLayout, TabKey[]> = {
  original: ['home', 'sessions', 'feed', 'search'],
  cards5: ['home', 'cards', 'sessions', 'feed', 'search'],
  lnb4: ['home', 'cards', 'feed', 'search'],
  calendar: ['home', 'cards', 'calendar', 'feed', 'search'],
};

/** 하단 탭바. layout 을 안 넘기면 NAV_DESIGN.tabs 를 따른다.
 * 고른 구성에 캘린더 탭이 없을 때 캘린더 화면에서는 캘린더 포함 5칸으로 보여준다. */
export function TabBar({ active, layout }: { active: TabKey; layout?: TabLayout }) {
  const nav = React.useContext(NavDesignContext);
  const chosen = layout ?? nav.tabs;
  const keys = LAYOUT_TABS[chosen].includes(active) ? LAYOUT_TABS[chosen] : LAYOUT_TABS.calendar;
  const tabs = TABS.filter((t) => keys.includes(t.key));
  return (
    <View className="h-[72px] flex-row border-t border-border bg-background">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <View key={t.key} className="flex-1 items-center justify-center gap-1">
            <Icon as={t.icon} size={22} className={on ? 'text-primary' : 'text-muted-foreground'} />
            <Text
              className={cn('text-[11px]', on ? 'font-bold text-primary' : 'text-muted-foreground')}
            >
              {t.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function TopBar({
  title,
  back = true,
  menu = false,
  center = false,
  right,
}: {
  title: string;
  back?: boolean;
  /** 뒤로 대신 왼쪽 메뉴 버튼을 보여 줘요 (탭의 첫 화면) */
  menu?: boolean;
  center?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View className="h-14 flex-row items-center gap-2 border-b border-border px-4">
      {menu ? (
        <Icon as={MenuIcon} size={22} className="text-foreground" />
      ) : back ? (
        <Icon as={ChevronLeftIcon} size={24} className="text-foreground" />
      ) : null}
      <Text
        className={cn(
          'flex-1 text-base font-bold text-foreground',
          center && 'text-center font-medium text-muted-foreground',
        )}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

/** 떠 있는 버튼. primary = AI, outline = 녹음 */
export function Fab({
  icon,
  variant = 'primary',
  size = 56,
  className,
}: {
  icon: LucideIcon;
  variant?: 'primary' | 'outline';
  size?: number;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full shadow-lg shadow-black/20',
        variant === 'primary' ? 'bg-primary' : 'border border-border bg-background',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        as={icon}
        size={size * 0.42}
        className={variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'}
      />
    </View>
  );
}

export type SpeedDialItem = { icon: LucideIcon; label: string; ai?: boolean };

/** 빠른 도구. 버튼 하나가 떠 있고, 누르면 도구들이 이름과 같이 위로 펼쳐져요. 홈에서만 보여요 */
export function SpeedDial({
  items,
  open: openProp,
  onOpenChange,
}: {
  items: SpeedDialItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = React.useState(false);
  const open = openProp ?? inner;
  const toggle = () => {
    setInner(!open);
    onOpenChange?.(!open);
  };
  return (
    <View className="items-end gap-3">
      {open
        ? items.map((it) => (
            <View key={it.label} className="flex-row items-center gap-2.5">
              <View className="rounded-full bg-foreground px-3 py-1.5 shadow-lg shadow-black/20">
                <Text className="text-[13px] font-bold text-background">{it.label}</Text>
              </View>
              <View
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/20',
                  it.ai ? 'bg-ai' : 'border border-border bg-background',
                )}
              >
                <Icon
                  as={it.icon}
                  size={20}
                  className={it.ai ? 'text-ai-foreground' : 'text-foreground'}
                />
              </View>
            </View>
          ))
        : null}
      <Pressable
        onPress={toggle}
        accessibilityLabel={open ? '빠른 도구 닫기' : '빠른 도구'}
        className={cn(
          'h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-black/20',
          open ? 'border border-border bg-background' : 'bg-primary',
        )}
      >
        <Icon
          as={open ? XIcon : ZapIcon}
          size={24}
          className={open ? 'text-foreground' : 'text-primary-foreground'}
        />
      </Pressable>
    </View>
  );
}

export function FilterChips({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange?: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((it) => {
        const on = it === active;
        return (
          <Pressable
            key={it}
            onPress={() => onChange?.(it)}
            className={cn(
              'h-9 justify-center rounded-full border px-4',
              on ? 'border-foreground bg-foreground' : 'border-border bg-background',
            )}
          >
            <Text className={cn('text-sm', on ? 'font-bold text-background' : 'text-foreground')}>
              {it}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 목록/그래프 같은 2~3개 전환 */
export function SegmentTabs({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange?: (v: string) => void;
}) {
  return (
    <View className="flex-row self-start rounded-lg bg-muted p-1">
      {items.map((it) => {
        const on = it === active;
        return (
          <Pressable
            key={it}
            onPress={() => onChange?.(it)}
            className={cn('rounded-md px-4 py-2', on && 'bg-background shadow-sm shadow-black/10')}
          >
            <Text
              className={cn('text-sm', on ? 'font-bold text-foreground' : 'text-muted-foreground')}
            >
              {it}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ChipItem = { key: string; label: string; count?: number; dot?: string };

/** 옆으로 넘기는 필터 칩 한 줄. 줄을 두 개 쌓아서 서로 다른 기준(상태, 종류)을 같이 걸러요 */
export function ScrollChips({
  items,
  active,
  onChange,
}: {
  items: ChipItem[];
  active: string;
  onChange?: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-5"
    >
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange?.(it.key)}
            className={cn(
              'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
              on ? 'border-foreground bg-foreground' : 'border-border bg-background',
            )}
          >
            {it.dot ? <View className={cn('h-2 w-2 rounded-full', it.dot)} /> : null}
            <Text
              className={cn('text-[13px]', on ? 'font-bold text-background' : 'text-foreground')}
            >
              {it.label}
            </Text>
            {it.count !== undefined ? (
              <Text
                className={cn('text-[13px] font-bold', on ? 'text-background' : 'text-primary')}
              >
                {it.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 정렬 버튼. 누르면 정렬 기준을 차례로 바꿔요 (앱에서는 팝업으로 골라요) */
export function SortButton({ options }: { options: string[] }) {
  const [at, setAt] = React.useState(0);
  return (
    <Pressable
      onPress={() => setAt((i) => (i + 1) % options.length)}
      accessibilityLabel="정렬 바꾸기"
      className="h-9 flex-row items-center gap-1 rounded-md px-2"
    >
      <Icon as={ArrowUpDownIcon} size={15} className="text-muted-foreground" />
      <Text className="text-[13px] text-foreground">{options[at]}</Text>
    </Pressable>
  );
}
