import { colors, fontSize, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { members } from './members';
import { useDevlogs } from './store';
import { weekKey } from './week';

/** 오늘 화면: 이번 주 일지를 몇 명이 썼는지와 바로 가기 */
export function DevlogSection() {
  const { logs, loading } = useDevlogs();
  const week = weekKey(new Date());
  const written = members.filter((m) => logs.some((l) => l.week === week && l.author === m.role));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>이번 주 개발일지</Text>
        <Link href="/devlog" style={styles.link}>
          보기
        </Link>
      </View>
      <Text style={styles.muted}>
        {loading
          ? '불러오는 중'
          : `${written.length}/${members.length}명 썼어요${
              written.length ? ` · ${written.map((m) => m.name).join(', ')}` : ''
            }`}
      </Text>
      <Link href="/devlog-new" style={styles.link}>
        내 일지 쓰기
      </Link>
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
