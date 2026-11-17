import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** 아래에서 올라오는 시트. 미리보기에서는 부모 바닥에 붙여서 보여준다. */
export function BottomSheet({
  title,
  icon,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'gap-4 rounded-t-2xl border border-b-0 border-border bg-popover px-5 pb-8 pt-3 shadow-2xl shadow-black/20',
        className,
      )}
    >
      <View className="h-1 w-10 self-center rounded-full bg-border" />
      {title ? (
        <View className="flex-row items-center gap-2">
          {icon ? <Icon as={icon} size={20} className="text-ai" /> : null}
          <Text className="text-lg font-bold text-popover-foreground">{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Scrim() {
  return <View pointerEvents="none" className="absolute inset-0 bg-black/25" />;
}

export type SlashItem = {
  icon?: LucideIcon;
  label: string;
  hint?: string;
  ai?: boolean;
  selected?: boolean;
};

/** 편집기에서 / 를 쳤을 때 뜨는 메뉴 */
export function SlashMenu({ groups }: { groups: { title: string; items: SlashItem[] }[] }) {
  return (
    <View className="w-[280px] gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-xl shadow-black/15">
      {groups.map((g) => (
        <View key={g.title} className="gap-0.5">
          <Text className="px-2.5 pb-1 pt-2 text-xs text-muted-foreground">{g.title}</Text>
          {g.items.map((it) => (
            <View
              key={it.label}
              className={cn(
                'flex-row items-center gap-3 rounded-lg px-2.5 py-2',
                it.selected && 'bg-accent',
              )}
            >
              {it.icon ? (
                <Icon
                  as={it.icon}
                  size={18}
                  className={it.ai ? 'text-ai' : 'text-popover-foreground'}
                />
              ) : null}
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-popover-foreground">
                  {it.label}
                </Text>
                {it.hint ? <Text className="text-xs text-muted-foreground">{it.hint}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** 짧은 알림. 되돌리기 같은 행동 하나를 붙일 수 있다 */
export function Toast({ message, action }: { message: string; action?: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-foreground px-4 py-3 shadow-lg shadow-black/20">
      <Text className="flex-1 text-sm text-background">{message}</Text>
      {action ? <Text className="text-sm font-bold text-primary-soft">{action}</Text> : null}
    </View>
  );
}
