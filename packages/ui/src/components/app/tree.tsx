import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { cn } from '../../lib/utils';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  PlusIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

// 폴더처럼 펼치고 접는 목록이에요. 세션 자료함과 왼쪽 메뉴에서 써요.
// 구조는 docs/benchmark/README.md 의 "자료함" 항목을 따라요.

/** 폴더나 문서 한 줄. depth 만큼 들여쓰고, 폴더는 눌러서 펼치고 접어요. 길게 누르면 동작 시트가 열려요 */
export function TreeRow({
  icon,
  label,
  depth = 0,
  count,
  expanded,
  strong = false,
  selected = false,
  meta,
  status,
  done,
  shared = false,
  onPress,
  onAdd,
  onLongPress,
  onToggleDone,
}: {
  icon: LucideIcon;
  label: string;
  /** 들여쓰기 단계. 0 이 가장 바깥 */
  depth?: number;
  count?: number;
  /** 넘기면 폴더 줄이에요. true 는 펼친 상태 */
  expanded?: boolean;
  /** 가장 바깥 묶음처럼 굵게 */
  strong?: boolean;
  selected?: boolean;
  /** 오른쪽 회색 글자 (고친 때 등) */
  meta?: string;
  /** 오른쪽 강조 글자 (고치는 중, 기기에 보관 등 지금 상태) */
  status?: string;
  /** 넘기면 할 일 문서예요. 아이콘 자리에 체크 칸이 와요 */
  done?: boolean;
  /** 밖에 공개 중이면 이름 옆에 지구본 */
  shared?: boolean;
  onToggleDone?: () => void;
  onPress?: () => void;
  onAdd?: () => void;
  onLongPress?: () => void;
}) {
  const folder = expanded !== undefined;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={folder ? `${label} ${expanded ? '접기' : '펼치기'}` : label}
      className={cn('h-12 flex-row items-center gap-3 rounded-md pr-1', selected && 'bg-accent')}
      style={{ paddingLeft: 4 + depth * 24 }}
    >
      {done !== undefined ? (
        <Pressable
          onPress={onToggleDone}
          hitSlop={10}
          accessibilityLabel={done ? '안 끝난 것으로 되돌리기' : '끝냄'}
          className={cn(
            'h-5 w-5 items-center justify-center rounded border-2',
            done ? 'border-primary bg-primary' : 'border-input bg-background',
          )}
        >
          {done ? <Icon as={CheckIcon} size={12} className="text-primary-foreground" /> : null}
        </Pressable>
      ) : (
        <Icon
          as={icon}
          size={strong ? 22 : 20}
          className={folder || strong ? 'text-foreground' : 'text-muted-foreground'}
        />
      )}
      <View className="flex-1 flex-row items-center gap-1.5">
        <Text
          numberOfLines={1}
          className={cn(
            'shrink text-foreground',
            strong ? 'text-[17px] font-bold' : 'text-base',
            done && 'text-muted-foreground line-through',
          )}
        >
          {label}
        </Text>
        {shared ? <Icon as={GlobeIcon} size={14} className="text-primary" /> : null}
      </View>
      {status ? <Text className="text-xs font-bold text-primary">{status}</Text> : null}
      {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
      {count !== undefined ? (
        <Text className="text-[13px] text-muted-foreground">{count}</Text>
      ) : null}
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          className="h-11 w-9 items-center justify-center"
          accessibilityLabel={`${label}에 새로 만들기`}
        >
          <Icon as={PlusIcon} size={20} className="text-muted-foreground" />
        </Pressable>
      ) : null}
      {folder ? (
        <View className="h-11 w-8 items-center justify-center">
          <Icon
            as={expanded ? ChevronDownIcon : ChevronRightIcon}
            size={18}
            className="text-muted-foreground"
          />
        </View>
      ) : null}
    </Pressable>
  );
}
