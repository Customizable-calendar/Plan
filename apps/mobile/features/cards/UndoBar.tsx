import { colors, fontSize, space } from '@noteapp/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { undoLast, useUndo } from './store';

/** 방금 한 확인·버리기를 5초 동안 되돌릴 수 있어요. floating이면 화면 아래에 떠요. */
export function UndoBar({ floating }: { floating?: boolean }) {
  const undo = useUndo();
  if (!undo) return null;
  return (
    <View style={[styles.bar, floating && styles.floating]} accessibilityLiveRegion="polite">
      <Text style={styles.label}>{undo.label}</Text>
      <Pressable onPress={undoLast} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.action}>되돌리기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: colors.ink,
  },
  floating: { position: 'absolute', left: space.md, right: space.md, bottom: space.md },
  label: { flex: 1, fontSize: fontSize.caption, color: colors.surface },
  action: { fontSize: fontSize.caption, fontWeight: '700', color: '#9DB4FF' },
});
