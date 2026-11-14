import { Pressable, StyleSheet, Text } from 'react-native';

import { calendarTokens } from './tokens';

export function useCalendarTheme() {
  // 앱의 userInterfaceStyle: light와 디자인 시스템의 밝은 테마를 따라요.
  const colors = calendarTokens.light;
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    card: {
      padding: 16,
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    title: { fontSize: 26, fontWeight: '700', color: colors.foreground },
    heading: { fontSize: 17, fontWeight: '700', color: colors.foreground },
    text: { fontSize: 15, lineHeight: 22, color: colors.foreground },
    muted: { fontSize: 13, lineHeight: 20, color: colors.mutedForeground },
    banner: { padding: 12, borderRadius: 10, backgroundColor: colors.muted },
    event: {
      padding: 12,
      gap: 4,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.cal1,
      backgroundColor: colors.cal1Soft,
    },
    input: {
      minHeight: 64,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.input,
      color: colors.foreground,
      backgroundColor: colors.background,
      textAlignVertical: 'top',
    },
  });
  return { colors, styles };
}
export function CalendarButton({
  label,
  onPress,
  selected = false,
  disabled = false,
  singleLine = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  singleLine?: boolean;
}) {
  const { colors } = useCalendarTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : colors.card,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text
        numberOfLines={singleLine ? 1 : undefined}
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: selected ? colors.primaryForeground : colors.foreground,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
