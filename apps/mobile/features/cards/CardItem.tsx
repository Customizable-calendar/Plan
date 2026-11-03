import type { Card } from '@noteapp/shared';
import { colors, fontSize, space } from '@noteapp/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getNoteText } from './data';
import { cardDetail, typeLabel } from './format';
import { confirmCard, dismissCard, renameCard, restoreCard } from './store';

export function CardItem({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const [source, setSource] = useState<string | null>(null);
  const detail = cardDetail(card);

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
    <View style={[styles.card, card.status === 'confirmed' && styles.confirmed]}>
      <View style={styles.header}>
        <Text style={styles.type}>{typeLabel[card.type]}</Text>
        {card.status === 'confirmed' && <Text style={styles.badge}>확인됨</Text>}
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
        <Text style={styles.title}>{card.title}</Text>
      )}
      {detail && <Text style={styles.detail}>{detail}</Text>}

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
    gap: space.sm,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  confirmed: { borderColor: colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  type: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  badge: { fontSize: fontSize.caption, color: colors.muted },
  title: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink },
  input: {
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderColor: colors.accent,
  },
  detail: { fontSize: fontSize.caption, color: colors.muted },
  source: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    color: colors.muted,
    padding: space.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  highlight: { fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { fontSize: fontSize.caption, fontWeight: '600', color: colors.ink },
  primaryText: { color: colors.surface },
});
