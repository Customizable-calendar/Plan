import { colors, fontSize, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/** 오늘 화면: 세션 화면으로 가는 입구 */
export function SessionsSection() {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>세션</Text>
        <Link href="/sessions" style={styles.link}>
          보기
        </Link>
      </View>
      <Text style={styles.muted}>업무일지·블로그·회의록 같은 양식으로 문서를 써요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  muted: { fontSize: fontSize.caption, color: colors.muted },
});
