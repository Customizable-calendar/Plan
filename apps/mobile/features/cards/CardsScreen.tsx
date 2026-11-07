import type { CardType } from '@noteapp/shared';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardItem } from './CardItem';
import { typeLabel } from './format';
import { confirmCards, restoreCard, useCards } from './store';
import { SwipeRow } from './SwipeRow';
import { CardDeck } from './CardDeck';
import { useDragging } from './dragging';
import { TryMemo } from './TryMemo';
import { UndoBar } from './UndoBar';

const filters: (CardType | 'all')[] = ['all', 'event', 'task', 'person', 'idea'];

/** memo: 맨 위에 둘 막 쓰기 칸. 라우트가 notes 기능의 입력을 넣어 줘요. 없으면 예전 TryMemo를 써요. */
export function CardsScreen({ memo }: { memo?: ReactNode }) {
  const { cards, loading } = useCards();
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  // 한 장씩(틴더처럼) 넘기기가 기본, 목록으로도 볼 수 있어요.
  const [deck, setDeck] = useState(true);
  const dragging = useDragging();

  const shown = cards.filter((c) => filter === 'all' || c.type === filter);
  const waiting = shown.filter((c) => c.status === 'suggested');
  const confirmed = shown.filter((c) => c.status === 'confirmed');
  const dismissed = shown.filter((c) => c.status === 'dismissed');

  return (
    <View style={screen.container}>
      <ScrollView
        style={screen.container}
        contentContainerStyle={[screen.content, styles.bottomRoom]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
      >
        {memo ?? <TryMemo />}

        <View style={styles.filters}>
          {filters.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f }}
              style={[styles.chip, filter === f && styles.chipOn]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>
                {f === 'all' ? '전체' : typeLabel[f]}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && <Text style={styles.empty}>불러오는 중</Text>}

        <Section
          title={`확인 기다리는 카드 ${waiting.length}`}
          action={
            <View style={styles.actions}>
              {waiting.length > 1 && (
                <Pressable
                  onPress={() => setDeck((d) => !d)}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.undo}>{deck ? '목록으로' : '한 장씩'}</Text>
                </Pressable>
              )}
              {waiting.length > 1 && (
                <Pressable
                  onPress={() => confirmCards(waiting.map((c) => c.id))}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.undo}>모두 확인</Text>
                </Pressable>
              )}
            </View>
          }
        >
          {waiting.length === 0 && !loading && <Text style={styles.empty}>모두 확인했어요.</Text>}
          {waiting.length > 0 && (
            <Text style={styles.empty}>오른쪽으로 밀면 확인, 왼쪽으로 밀면 버려요.</Text>
          )}
          {deck ? (
            <CardDeck cards={waiting} />
          ) : (
            waiting.map((c) => (
              <SwipeRow key={c.id} cardId={c.id}>
                <CardItem card={c} />
              </SwipeRow>
            ))
          )}
        </Section>

        {confirmed.length > 0 && (
          <Section title={`확인한 카드 ${confirmed.length}`}>
            {confirmed.map((c) => (
              <CardItem key={c.id} card={c} />
            ))}
            <Link href="/draft" style={styles.draft}>
              확인한 카드로 초안 만들기
            </Link>
          </Section>
        )}

        {dismissed.length > 0 && (
          <Section title={`버린 카드 ${dismissed.length}`}>
            {dismissed.map((c) => (
              <Pressable key={c.id} onPress={() => restoreCard(c.id)} accessibilityRole="button">
                <Text style={styles.dismissed}>
                  {typeLabel[c.type]} · {c.title} <Text style={styles.undo}>되살리기</Text>
                </Text>
              </Pressable>
            ))}
          </Section>
        )}
      </ScrollView>
      <UndoBar floating />
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: fontSize.caption, color: colors.ink },
  chipTextOn: { color: colors.surface, fontWeight: '700' },
  section: { gap: space.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomRoom: { paddingBottom: 80 },
  actions: { flexDirection: 'row', gap: space.md },
  sectionTitle: { fontSize: fontSize.caption, fontWeight: '700', color: colors.muted },
  empty: { fontSize: fontSize.caption, color: colors.muted },
  dismissed: { fontSize: fontSize.caption, color: colors.muted, paddingVertical: space.xs },
  undo: { color: colors.accent, fontWeight: '600' },
  draft: {
    paddingVertical: space.sm,
    textAlign: 'center',
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.accent,
  },
});
