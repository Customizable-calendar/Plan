import type { Card } from '@noteapp/shared';
import { colors, fontSize, space } from '@noteapp/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getHints, getNoteText } from './data';
import { cardDetail, typeLabel } from './format';
import { look, typeColor } from './look';
import { confirmCard, dismissCard, renameCard, restoreCard } from './store';

// 디자인 시스템 ExtractedCard 규칙: 확인 전(suggested)은 점선, 확인한 카드는 실선.
// 종류 칩은 색과 글자 라벨을 같이 써요.

export function CardItem({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const [source, setSource] = useState<string | null>(null);
  const detail = cardDetail(card);
  const [hints, setHints] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getHints(card).then(
      (h) => alive && setHints(h),
      () => alive && setHints([]),
    );
    return () => {
      alive = false;
    };
  }, [card]);

  const toggleSource = async () => {
    if (source !== null) return setSource(null);
    setSource((await getNoteText(card.source.noteId)) ?? '');
  };

  const saveTitle = () => {
    const title = draft.trim();
    if (title && title !== card.title) void renameCard(card.id, title);
    setDraft(title || card.title);
    setEditing(false);
  };

  return (
    <View
      style={[
        styles.card,
        card.status === 'suggested' && styles.suggested,
        card.status === 'dismissed' && styles.dismissed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.chip, { backgroundColor: typeColor[card.type].bg }]}>
          <Text style={[styles.chipText, { color: typeColor[card.type].fg }]}>
            {typeLabel[card.type]}
          </Text>
        </View>
        <View style={styles.flex} />
        {card.status === 'confirmed' && <Text style={styles.badge}>확인됨</Text>}
        <View style={[styles.chip, { backgroundColor: look.muted }]}>
          <Text style={[styles.chipText, styles.sourceText]}>메모</Text>
        </View>
      </View>

      {editing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={saveTitle}
          onBlur={saveTitle}
          autoFocus
          returnKeyType="done"
          accessibilityLabel="카드 제목"
          style={[styles.title, styles.input]}
        />
      ) : (
        <Text style={[styles.title, card.status === 'dismissed' && styles.struck]}>
          {card.title}
        </Text>
      )}
      {detail && <Text style={styles.detail}>{detail}</Text>}
      {hints.map((h) => (
        <Text key={h} style={styles.hint}>
          {h}
        </Text>
      ))}

      {source !== null && <SourceText text={source} span={card.source.span} />}

      <View style={styles.actions}>
        {card.status === 'suggested' && (
          <>
            <Action label="확인" primary onPress={() => confirmCard(card.id)} />
            <Action label="고치기" onPress={() => setEditing(true)} />
            <Action label="버리기" onPress={() => dismissCard(card.id)} />
          </>
        )}
        {card.status === 'confirmed' && (
          <Action label="되돌리기" onPress={() => restoreCard(card.id)} />
        )}
        <Action label={source === null ? '원문 보기' : '원문 닫기'} onPress={toggleSource} />
      </View>
    </View>
  );
}

/** 메모 원문에서 이 카드가 나온 부분을 굵게 보여줘요. */
function SourceText({ text, span: [start, end] }: { text: string; span: [number, number] }) {
  if (!text) return <Text style={styles.source}>원문을 찾지 못했어요.</Text>;
  return (
    <Text style={styles.source}>
      {text.slice(0, start)}
      <Text style={styles.highlight}>{text.slice(start, end)}</Text>
      {text.slice(end)}
    </Text>
  );
}

function Action({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={[styles.action, primary && styles.primary]}
    >
      <Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: look.radius,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  suggested: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: `${look.primary}66`,
    backgroundColor: look.primarySoft,
  },
  dismissed: { backgroundColor: look.muted, opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  chip: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '700' },
  sourceText: { fontWeight: '400', color: colors.muted },
  badge: { fontSize: 11, color: colors.muted },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  struck: { textDecorationLine: 'line-through' },
  input: {
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderColor: look.primary,
  },
  detail: { fontSize: 12, color: colors.muted },
  hint: { fontSize: 12, color: look.secondary },
  source: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    color: colors.muted,
    padding: space.sm,
    borderRadius: look.radius - 4,
    backgroundColor: colors.surface,
  },
  highlight: { fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: look.radius - 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  primary: { backgroundColor: look.primary, borderColor: look.primary },
  actionText: { fontSize: fontSize.caption, fontWeight: '600', color: colors.ink },
  primaryText: { color: colors.surface },
});
