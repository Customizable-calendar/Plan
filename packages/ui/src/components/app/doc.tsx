import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { cn } from '../../lib/utils';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilLineIcon,
  SmartphoneIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

// 문서를 쓰고 고칠 때 쓰는 컴포넌트예요. 구조는 docs/benchmark/README.md 의 "personal-memo 에서 볼 것"을 따라요.

export type SaveState = 'editing' | 'saved' | 'local' | 'failed';

const SAVE: Record<SaveState, { icon: LucideIcon; label: string; tone: string }> = {
  editing: { icon: PencilLineIcon, label: '고치는 중', tone: 'text-primary' },
  saved: { icon: CheckIcon, label: '저장됨', tone: 'text-muted-foreground' },
  local: { icon: SmartphoneIcon, label: '기기에 보관', tone: 'text-foreground' },
  failed: { icon: AlertTriangleIcon, label: '저장 안 됨', tone: 'text-destructive' },
};

/** 지금 저장 상태. 아이콘과 글자로만 알려요. 로그인 전이나 연결이 끊기면 "기기에 보관"이에요 */
export function SaveStatus({ state, onPress }: { state: SaveState; onPress?: () => void }) {
  const s = SAVE[state];
  return (
    <Pressable onPress={onPress} hitSlop={10} className="flex-row items-center gap-1">
      <Icon as={s.icon} size={13} className={s.tone} />
      <Text className={cn('text-xs', state === 'saved' ? '' : 'font-bold', s.tone)}>{s.label}</Text>
    </Pressable>
  );
}

/** 접을 수 있는 구역 제목. 본문의 제목 줄 왼쪽에 화살표가 붙어요 */
export function FoldHeading({
  children,
  open = true,
  onPress,
}: {
  children: string;
  open?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="-ml-1 flex-row items-center gap-1"
      accessibilityLabel={`${children} ${open ? '접기' : '펼치기'}`}
    >
      <Icon
        as={open ? ChevronDownIcon : ChevronRightIcon}
        size={18}
        className="text-muted-foreground"
      />
      <Text className="text-lg font-bold text-foreground">{children}</Text>
    </Pressable>
  );
}

/** 목차의 한 줄. 누르면 그 제목으로 가요. level 2 는 한 단계 들여써요 */
export function OutlineRow({
  label,
  level = 1,
  current = false,
  note,
}: {
  label: string;
  level?: 1 | 2;
  current?: boolean;
  note?: string;
}) {
  return (
    <View className="h-11 flex-row items-center gap-3" style={{ paddingLeft: (level - 1) * 20 }}>
      <View className={cn('h-5 w-0.5 rounded-full', current ? 'bg-primary' : 'bg-transparent')} />
      <Text
        numberOfLines={1}
        className={cn(
          'flex-1',
          level === 1 ? 'text-base' : 'text-[15px]',
          current ? 'font-bold text-foreground' : 'text-foreground',
        )}
      >
        {label}
      </Text>
      {note ? <Text className="text-xs text-muted-foreground">{note}</Text> : null}
    </View>
  );
}

/** 고친 기록의 한 줄. 누가 언제 고쳤는지 보여 주고, 골라서 되돌려요 */
export function HistoryRow({
  when,
  who,
  change,
  current = false,
  onRestore,
}: {
  when: string;
  /** 내가 고침, AI 초안 */
  who: string;
  change: string;
  current?: boolean;
  onRestore?: () => void;
}) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-popover-foreground">{when}</Text>
          <Text className="text-xs text-muted-foreground">{who}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">{change}</Text>
      </View>
      {current ? (
        <Text className="text-[13px] text-muted-foreground">지금</Text>
      ) : (
        <Pressable onPress={onRestore} className="h-11 justify-center pl-3">
          <Text className="text-[15px] font-bold text-primary">되돌리기</Text>
        </Pressable>
      )}
    </View>
  );
}
