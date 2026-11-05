import { colors, fontSize, space } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ToolbarActions {
  onSlash: () => void;
  onMic: () => void;
  onAi: () => void;
  onPhoto: () => void;
  onCheckbox: () => void;
}

/** 편집기 아래 도구 막대: / · 녹음 · AI · 사진 · 체크 */
export function Toolbar({ onSlash, onMic, onAi, onPhoto, onCheckbox }: ToolbarActions) {
  return (
    <View style={styles.bar}>
      <ToolButton label="슬래시 명령" onPress={onSlash}>
        <Text style={styles.slash}>/</Text>
      </ToolButton>
      <ToolButton label="녹음" onPress={onMic}>
        <Icon name={{ ios: 'mic', android: 'mic', web: 'mic' }} />
      </ToolButton>
      <ToolButton label="AI로 다듬기" onPress={onAi}>
        <Icon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} accent />
      </ToolButton>
      <ToolButton label="사진 넣기" onPress={onPhoto}>
        <Icon name={{ ios: 'photo', android: 'image', web: 'image' }} />
      </ToolButton>
      <ToolButton label="체크 항목 넣기" onPress={onCheckbox}>
        <Icon name={{ ios: 'checkmark.square', android: 'check_box', web: 'check_box' }} />
      </ToolButton>
    </View>
  );
}

function ToolButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function Icon({ name, accent }: { name: SymbolViewProps['name']; accent?: boolean }) {
  return <SymbolView name={name} size={22} tintColor={accent ? colors.accent : colors.ink} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  button: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  pressed: { backgroundColor: colors.background },
  slash: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
});
