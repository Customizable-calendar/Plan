import { colors, fontSize, screen, space } from '@noteapp/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { type Role, memberOf, members } from './members';
import { splitSections, studyQuestions } from './parse';
import { devlogPrompt } from './prompt';
import { saveDevlog } from './store';
import { weekKey, weekLabel } from './week';

// 1) 부탁 문장을 복사해 각자 코딩 AI에 넣고 2) 받은 답을 붙여 넣어 저장해요.
// TODO(B, M3): 설정의 AI 키로 앱 안에서 바로 정리하기

export function DevlogNewScreen() {
  // TODO(B, M2): 로그인한 사람으로 고정해요.
  const [author, setAuthor] = useState<Role>('B');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const week = weekKey(new Date());
  const prompt = devlogPrompt(memberOf(author), week);

  const sections = splitSections(body);
  const questions = studyQuestions(body);

  const save = async () => {
    try {
      await saveDevlog({ author, week, body: body.trim() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView
      style={screen.container}
      contentContainerStyle={screen.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.muted}>{weekLabel(week)} 일지</Text>

      <Step n={1} title="누가 쓰나요">
        <View style={styles.row}>
          {members.map((m) => (
            <Pressable
              key={m.role}
              onPress={() => setAuthor(m.role)}
              accessibilityRole="button"
              accessibilityState={{ selected: author === m.role }}
              style={[styles.chip, author === m.role && styles.chipOn]}
            >
              <Text style={[styles.chipText, author === m.role && styles.chipTextOn]}>
                {m.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Step>

      <Step n={2} title="AI에게 정리 부탁하기">
        <Text style={styles.muted}>
          아래 문장을 쓰는 코딩 AI(Claude Code, Codex 등)에 레포를 연 채로 붙여 넣어요.
        </Text>
        <Text selectable style={styles.prompt}>
          {prompt}
        </Text>
        <Pressable
          onPress={() => Share.share({ message: prompt })}
          accessibilityRole="button"
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>문장 복사·보내기</Text>
        </Pressable>
      </Step>

      <Step n={3} title="받은 답 붙여 넣기">
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="## 만든 것 …"
          placeholderTextColor={colors.muted}
          accessibilityLabel="개발일지 본문"
          style={styles.input}
        />
        {body.trim() !== '' && (
          <Text style={styles.muted}>
            섹션 {sections.length}개 · 스터디 질문 {questions.length}개
            {sections.length <= 1 ? ' · ## 제목이 없으면 한 덩어리로 저장돼요' : ''}
          </Text>
        )}
      </Step>

      <Pressable
        onPress={save}
        disabled={!body.trim()}
        accessibilityRole="button"
        style={[styles.primary, !body.trim() && styles.disabled]}
      >
        <Text style={styles.primaryText}>저장</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.muted}>같은 주에 다시 저장하면 바꿔 써요.</Text>
    </ScrollView>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>
        {n}. {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: space.sm },
  stepTitle: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  prompt: {
    maxHeight: 220,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
    padding: space.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  input: {
    minHeight: 200,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: 'top',
  },
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
  secondary: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryText: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  primaryText: { fontSize: fontSize.body, fontWeight: '700', color: colors.surface },
  error: { fontSize: fontSize.caption, color: '#C0392B' },
});
