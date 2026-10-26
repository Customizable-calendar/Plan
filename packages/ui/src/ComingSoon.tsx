import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, space } from './theme';

interface ComingSoonProps {
  title: string;
  description: string;
  /** 담당자 (A~D) */
  owner: string;
  /** screen: 화면 전체, section: 다른 화면 안의 한 구역 */
  variant?: 'screen' | 'section';
}

/** 아직 만들지 않은 화면·섹션의 자리 표시예요. 기능을 만들면 지워요. */
export function ComingSoon({ title, description, owner, variant = 'screen' }: ComingSoonProps) {
  return (
    <View style={variant === 'screen' ? styles.screen : styles.section}>
      <Text style={variant === 'screen' ? styles.screenTitle : styles.sectionTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.owner}>담당 {owner}, 준비 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.sm,
    backgroundColor: colors.background,
  },
  section: {
    padding: space.md,
    gap: space.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  screenTitle: { fontSize: fontSize.heading, fontWeight: '700', color: colors.ink },
  sectionTitle: { fontSize: fontSize.title, fontWeight: '600', color: colors.ink },
  description: { fontSize: fontSize.body, lineHeight: 24, color: colors.ink },
  owner: { fontSize: fontSize.caption, color: colors.muted },
});
