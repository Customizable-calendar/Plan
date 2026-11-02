import { colors, fontSize, space } from '@noteapp/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchWork, type WorkItem } from './github';

export interface Picked {
  item: WorkItem;
  note: string;
}

interface Props {
  login: string;
  since: string;
  picked: Record<number, Picked>;
  onChange: (next: Record<number, Picked>) => void;
}

/** 그 사람의 PR·이슈 목록. 고르면 배운 점 한두 줄 칸이 열려요. */
export function WorkPicker({ login, since, picked, onChange }: Props) {
  const reqKey = `${login}|${since}`;
  const [retry, setRetry] = useState(0);
  const [res, setRes] = useState<{ key: string; items?: WorkItem[]; error?: string }>({ key: '' });

  useEffect(() => {
    let live = true;
    const key = `${login}|${since}`;
    fetchWork(login, since).then(
      (items) => live && setRes({ key, items }),
      (e: unknown) => live && setRes({ key, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [login, since, retry]);

  if (res.key !== reqKey) return <Text style={styles.muted}>GitHub에서 불러오는 중</Text>;
  if (res.error)
    return (
      <View style={styles.gap}>
        <Text style={styles.error}>{res.error}</Text>
        <Pressable onPress={() => setRetry((n) => n + 1)} accessibilityRole="button">
          <Text style={styles.link}>다시 불러오기</Text>
        </Pressable>
      </View>
    );
  const items = res.items ?? [];
  if (items.length === 0)
    return <Text style={styles.muted}>이 기간에 올리거나 맡은 PR·이슈가 없어요.</Text>;

  const toggle = (item: WorkItem) => {
    const next = { ...picked };
    if (next[item.number]) delete next[item.number];
    else next[item.number] = { item, note: '' };
    onChange(next);
  };
  const setNote = (n: number, note: string) => onChange({ ...picked, [n]: { ...picked[n], note } });

  return (
    <View style={styles.gap}>
      {items.map((item) => {
        const on = !!picked[item.number];
        return (
          <View key={item.number} style={[styles.item, on && styles.itemOn]}>
            <Pressable
              onPress={() => toggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={styles.itemHead}
            >
              <Text style={[styles.check, on && styles.checkOn]}>{on ? '✓' : ''}</Text>
              <View style={styles.flex}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.muted}>
                  {item.kind === 'pr' ? 'PR' : '이슈'} #{item.number} · {item.state}
                </Text>
              </View>
            </Pressable>
            {on && (
              <TextInput
                value={picked[item.number].note}
                onChangeText={(t) => setNote(item.number, t)}
                placeholder="여기서 배운 점 한두 줄 (안 써도 돼요)"
                placeholderTextColor={colors.muted}
                multiline
                accessibilityLabel={`#${item.number}에서 배운 점`}
                style={styles.note}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  flex: { flex: 1, gap: 2 },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  error: { fontSize: fontSize.caption, color: '#C0392B' },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  item: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  itemOn: { borderColor: colors.accent, borderWidth: 1 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 14,
    fontWeight: '800',
    color: colors.surface,
    overflow: 'hidden',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  title: { fontSize: fontSize.body, color: colors.ink },
  note: {
    minHeight: 44,
    padding: space.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    fontSize: fontSize.body,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
