import { colors, fontSize, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { look, weekKey } from '@/features/devlog';

import { rankBoard } from './rank';
import { useQuizResults } from './store';

/** 오늘 화면: 이번 주 빌보드 1등과 바로 가기 */
export function DevquizSection() {
  const results = useQuizResults();
  const { ranks } = rankBoard(results, weekKey(new Date()));
  const top = ranks.filter((r) => r.rank === 1);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>공부 퀴즈 빌보드</Text>
        <Link href="/devquiz" style={styles.link}>
          보기
        </Link>
      </View>
      <Text style={styles.muted}>
        {top.length
          ? `이번 주 1등 ${top.map((r) => r.member.name).join(', ')} · ${top[0].score}점`
          : '이번 주는 아직 아무도 안 풀었어요'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: look.primary },
  muted: { fontSize: fontSize.caption, color: colors.muted },
});
