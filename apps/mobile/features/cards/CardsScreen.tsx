import type { CardType } from '@noteapp/shared';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardItem } from './CardItem';
import { typeLabel } from './format';
import { restoreCard, useCards } from './store';

const filters: (CardType | 'all')[] = ['all', 'event', 'task', 'person', 'idea'];

export function CardsScreen() {
  const { cards, loading } = useCards();
  const [filter, setFilter] = useState<CardType | 'all'>('all');

  const shown = cards.filter((c) => filter === 'all' || c.type === filter);
  const waiting = shown.filter((c) => c.status === 'suggested');
  const confirmed = shown.filter((c) => c.status === 'confirmed');
  const dismissed = shown.filter((c) => c.status === 'dismissed');

  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
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

      <Section title={`확인 기다리는 카드 ${waiting.length}`}>
        {waiting.length === 0 && !loading && <Text style={styles.empty}>모두 확인했어요.</Text>}
        {waiting.map((c) => (
          <CardItem key={c.id} card={c} />
        ))}
      </Section>

      {confirmed.length > 0 && (
        <Section title={`확인한 카드 ${confirmed.length}`}>
          {confirmed.map((c) => (
            <CardItem key={c.id} card={c} />
          ))}
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
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  sectionTitle: { fontSize: fontSize.caption, fontWeight: '700', color: colors.muted },
  empty: { fontSize: fontSize.caption, color: colors.muted },
  dismissed: { fontSize: fontSize.caption, color: colors.muted, paddingVertical: space.xs },
  undo: { color: colors.accent, fontWeight: '600' },
});
