import { colors, fontSize, space } from '@noteapp/ui';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SlashItem } from './slash';

/** `/`를 치면 도구 막대 위에 뜨는 명령 목록 */
export function SlashMenu({
  items,
  onPick,
}: {
  items: SlashItem[];
  onPick: (item: SlashItem) => void;
}) {
  return (
    <View style={styles.menu}>
      {items.length === 0 ? (
        <Text style={styles.empty}>맞는 명령이 없어요</Text>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            disabled={item.insert === null}
            onPress={() => onPick(item)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={[styles.label, item.insert === null && styles.disabled]} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.hint}>{item.hint}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingVertical: space.xs,
    borderRadius: 14,
    backgroundColor: colors.surface,
    ...Platform.select({
      android: { elevation: 6 },
      default: {
        shadowColor: '#1D2533',
        shadowOpacity: 0.15,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  item: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  pressed: { backgroundColor: colors.background },
  label: { fontSize: fontSize.body, color: colors.ink, fontWeight: '600' },
  disabled: { color: colors.muted },
  hint: { fontSize: fontSize.caption, color: colors.muted },
  empty: { padding: space.md, fontSize: fontSize.caption, color: colors.muted },
});
