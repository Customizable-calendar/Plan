import { Icon, Scrim, Text, cn } from '@noteapp/ui';
import type { LucideIcon } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';

export interface QuickMenuAction {
  icon: LucideIcon;
  label: string;
  ai?: boolean;
  onPress: () => void;
}

/** 날짜를 길게 눌렀을 때 뜨는 부채꼴 빠른 메뉴. 디자인 시스템 QuickActionMenu 규격을 따라요. */
export function CalendarQuickMenu({
  dateLabel,
  actions,
  onClose,
}: {
  dateLabel: string;
  actions: readonly QuickMenuAction[];
  onClose: () => void;
}) {
  const mid = (actions.length - 1) / 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="빠른 메뉴 닫기"
          onPress={onClose}
          className="absolute inset-0"
        >
          <Scrim />
        </Pressable>

        <View className="items-center gap-2">
          <View className="flex-row items-end gap-2.5">
            {actions.map((action, index) => {
              // 가운데 버튼이 가장 위로 올라가는 부채꼴 배치를 만들어요.
              const lift = (mid - Math.abs(index - mid)) * 14;
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateLabel}일 ${action.label}`}
                  onPress={action.onPress}
                  className="items-center gap-1"
                  style={{ marginBottom: lift }}
                >
                  <View
                    className={cn(
                      'h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/20',
                      action.ai ? 'bg-ai' : 'border border-border bg-popover',
                    )}
                  >
                    <Icon
                      as={action.icon}
                      size={20}
                      className={action.ai ? 'text-ai-foreground' : 'text-popover-foreground'}
                    />
                  </View>
                  <View className="rounded-full bg-foreground px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-background">{action.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-primary-soft">
            <Text className="text-[13px] font-bold text-primary-soft-foreground">{dateLabel}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
