import { Modal, Pressable, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 한 번 더 묻는 확인창. 지우기처럼 되돌리기 어려운 일 앞에 써요.
 * React Native의 Alert.alert는 웹에서 뜨지 않아서 Modal로 직접 만들었어요.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-foreground/30 px-8">
        <View className="w-full max-w-sm gap-2 rounded-xl bg-popover p-5">
          <Text className="text-lg font-bold text-popover-foreground">{title}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">{message}</Text>
          <View className="flex-row justify-end gap-2 pt-3">
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="h-10 justify-center rounded-md border border-border px-4 active:bg-muted"
            >
              <Text className="text-sm font-semibold text-foreground">취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              className="h-10 justify-center rounded-md bg-destructive px-4 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-destructive-foreground">
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
