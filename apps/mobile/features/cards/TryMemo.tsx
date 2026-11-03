import { colors, fontSize, space } from '@noteapp/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addFromText } from './store';

// 메모 편집기(A)가 붙기 전까지 카드 탭에서 바로 메모를 넣어 보는 칸이에요.
// TODO(B, M2): 편집기가 저장할 때 추출하게 되면 이 칸은 지워요.
export function TryMemo() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const memo = text.trim();
    if (!memo) return;
    try {
      const count = await addFromText(memo);
      setMessage(count ? `카드 ${count}장을 찾았어요.` : '찾은 카드가 없어요.');
      if (count) setText('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.box}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'메모를 써 보세요\n예: 내일 3시 민수랑 회의. 견적서 보내야 함'}
        placeholderTextColor={colors.muted}
        accessibilityLabel="메모"
        style={styles.input}
      />
      <View style={styles.row}>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          onPress={submit}
          disabled={!text.trim()}
          accessibilityRole="button"
          style={[styles.button, !text.trim() && styles.disabled]}
        >
          <Text style={styles.buttonText}>카드 찾기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  button: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: fontSize.caption, fontWeight: '700', color: colors.surface },
});
