import type { Note } from '@noteapp/shared';
import { colors, fontSize, space } from '@noteapp/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { listNotes, saveNote } from './data';

// 오늘 화면에 보여줄 최근 메모 개수
const LIMIT = 5;

export function QuickNoteSection() {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect: 화면이 처음 나타날 때 한 번 실행돼요. 여기서 예시 메모를 불러와요.
  useEffect(() => {
    listNotes()
      .then(setNotes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const canSave = text.trim().length > 0;

  const submit = async () => {
    try {
      const note = await saveNote(text);
      setNotes((prev) => [note, ...prev]); // 새 메모를 목록 맨 위에 붙여요
      setText('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>막 쓰기</Text>

      <View style={styles.box}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="생각나는 대로 적어 보세요"
          placeholderTextColor={colors.muted}
          accessibilityLabel="메모 입력"
          style={styles.input}
        />
        <View style={styles.row}>
          <Text style={styles.message}>{error}</Text>
          <Pressable
            onPress={submit}
            disabled={!canSave}
            accessibilityRole="button"
            style={[styles.button, !canSave && styles.disabled]}
          >
            <Text style={styles.buttonText}>저장</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subtitle}>최근 메모</Text>
      {loading ? (
        <Text style={styles.caption}>불러오는 중</Text>
      ) : notes.length === 0 ? (
        <Text style={styles.caption}>아직 쓴 메모가 없어요.</Text>
      ) : (
        notes.slice(0, LIMIT).map((n) => (
          <View key={n.id} style={styles.note}>
            <Text style={styles.noteText}>{n.text}</Text>
            <Text style={styles.caption}>{formatTime(n.createdAt)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/** "10월 26일 오전 10:00"처럼 기기 시간대로 보여줘요. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: fontSize.caption, fontWeight: '600', color: colors.muted },
  box: {
    gap: space.sm,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 72,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  message: { flex: 1, fontSize: fontSize.caption, color: colors.muted },
  caption: { fontSize: fontSize.caption, color: colors.muted },
  button: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: fontSize.caption, fontWeight: '700', color: colors.surface },
  note: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  noteText: { fontSize: fontSize.body, color: colors.ink },
});
