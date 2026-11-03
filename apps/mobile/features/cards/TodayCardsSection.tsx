import { colors, fontSize, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CardItem } from './CardItem';
import { useCards } from './store';

// 오늘 화면에는 확인을 기다리는 카드만 앞의 3장까지 보여주고, 나머지는 카드 탭으로 보내요.
const LIMIT = 3;

export function TodayCardsSection() {
  const { cards, loading } = useCards();
  const waiting = cards.filter((c) => c.status === 'suggested');

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>오늘의 카드</Text>
        <Link href="/cards" style={styles.more}>
          전체 보기
        </Link>
      </View>
      {loading ? (
        <Text style={styles.empty}>불러오는 중</Text>
      ) : waiting.length === 0 ? (
        <Text style={styles.empty}>확인할 카드가 없어요.</Text>
      ) : (
        <>
          {waiting.slice(0, LIMIT).map((c) => (
            <CardItem key={c.id} card={c} />
          ))}
          {waiting.length > LIMIT && (
            <Text style={styles.empty}>그 밖에 {waiting.length - LIMIT}장이 더 있어요.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
  more: { fontSize: fontSize.caption, fontWeight: '600', color: colors.accent },
  empty: { fontSize: fontSize.caption, color: colors.muted },
});
