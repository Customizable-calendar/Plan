import type { AiMessage } from '@noteapp/ai-client';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { askDevlogAi, hasAiKey, saveAiKey } from './ai';
import { fetchPrFiles } from './github';
import { Markdown } from './Markdown';
import { type Role, memberOf, members } from './members';
import { splitSections, studyQuestions } from './parse';
import { devlogPrompt, devlogRequest, type PickedWork, reviseRequest, TEMPLATE } from './prompt';
import { saveDevlog } from './store';
import { shiftWeek, weekKey, weekLabel } from './week';
import { type Picked, WorkPicker } from './WorkPicker';

// 1) 이번 주 PR·이슈를 고르고 배운 점 한두 줄 2) 앱 안 AI가 공통 템플릿으로 채워요
// 3) 말로 더 고쳐 달라고 하거나 직접 고치고 4) 저장. 키가 없으면 코딩 AI에 부탁 문장을 보내요.

type Range = 1 | 2;

export function DevlogNewScreen() {
  // TODO(B, M2): 로그인한 사람으로 고정해요.
  const [author, setAuthor] = useState<Role>('B');
  const [range, setRange] = useState<Range>(1);
  const [picked, setPicked] = useState<Record<number, Picked>>({});
  const [note, setNote] = useState('');

  const [keyReady, setKeyReady] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<AiMessage[]>([]);
  const [asks, setAsks] = useState<string[]>([]);
  const [ask, setAsk] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const week = weekKey(new Date());
  const member = memberOf(author);
  const since = range === 1 ? week : shiftWeek(week, -1);
  const pickedList = Object.values(picked);
  const lastReply = turns.length ? turns[turns.length - 1].content : '';

  useEffect(() => {
    hasAiKey().then(setKeyReady, () => setKeyReady(false));
  }, []);

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const fill = () =>
    run('PR 내용을 모아 AI가 채우는 중', async () => {
      const works: PickedWork[] = await Promise.all(
        pickedList.map(async ({ item, note: itemNote }) => ({
          item,
          note: itemNote,
          files: item.kind === 'pr' ? await fetchPrFiles(item.number).catch(() => []) : [],
        })),
      );
      const prompt = devlogRequest(member, week, works, note);
      const reply = await askDevlogAi([], prompt);
      setTurns([
        { role: 'user', content: prompt },
        { role: 'assistant', content: reply },
      ]);
      setAsks([]);
      setDraft(reply);
      setEditing(false);
    });

  const revise = () =>
    run('AI가 고치는 중', async () => {
      const text = ask.trim();
      const prompt = reviseRequest(text, draft !== lastReply ? draft : undefined);
      const reply = await askDevlogAi(turns, prompt);
      setTurns([
        ...turns,
        { role: 'user', content: prompt },
        { role: 'assistant', content: reply },
      ]);
      setAsks([...asks, text]);
      setAsk('');
      setDraft(reply);
      setEditing(false);
    });

  const save = () =>
    run('저장하는 중', async () => {
      await saveDevlog({ author, week, body: draft.trim() });
      router.back();
    });

  const pickAuthor = (role: Role) => {
    setAuthor(role);
    setPicked({});
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
            <Chip
              key={m.role}
              label={m.name}
              on={author === m.role}
              onPress={() => pickAuthor(m.role)}
            />
          ))}
        </View>
      </Step>

      <Step n={2} title="이번 주 PR·이슈 고르기">
        <View style={styles.row}>
          <Chip label="이번 주" on={range === 1} onPress={() => setRange(1)} />
          <Chip label="지난주부터" on={range === 2} onPress={() => setRange(2)} />
        </View>
        <WorkPicker login={member.github} since={since} picked={picked} onChange={setPicked} />
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="이번 주 전체 메모 (배운 점, 막힌 곳, 다음 주 할 일 등)"
          placeholderTextColor={colors.muted}
          accessibilityLabel="이번 주 메모"
          style={[styles.input, styles.inputSmall]}
        />
      </Step>

      <Step n={3} title="AI로 채우기">
        {keyReady === false && <KeyBox onSaved={() => setKeyReady(true)} />}
        {keyReady && (
          <Pressable
            onPress={fill}
            disabled={!!busy || (pickedList.length === 0 && !note.trim())}
            accessibilityRole="button"
            style={[
              styles.primary,
              (!!busy || (pickedList.length === 0 && !note.trim())) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {turns.length ? '처음부터 다시 채우기' : `AI로 일지 채우기 (${pickedList.length}개)`}
            </Text>
          </Pressable>
        )}
        <View style={styles.row}>
          <Pressable
            onPress={() => {
              setDraft(TEMPLATE);
              setEditing(true);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>빈 템플릿으로 직접 쓰기</Text>
          </Pressable>
          <Pressable onPress={() => setManual(!manual)} accessibilityRole="button">
            <Text style={styles.link}>{manual ? '닫기' : '키 없이 코딩 AI에 부탁하기'}</Text>
          </Pressable>
        </View>
        {manual && <ManualAsk prompt={devlogPrompt(member, week)} />}
      </Step>

      {busy && <Text style={styles.muted}>{busy}…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {(draft !== '' || manual) && (
        <Step n={4} title="확인하고 고치기">
          {asks.map((a, i) => (
            <Text key={i} style={styles.bubble}>
              {a}
            </Text>
          ))}
          <DraftView draft={draft} editing={editing || manual} onChange={setDraft} />
          {draft !== '' && (
            <Pressable onPress={() => setEditing(!editing)} accessibilityRole="button">
              <Text style={styles.link}>{editing ? '미리보기' : '직접 고치기'}</Text>
            </Pressable>
          )}
          {turns.length > 0 && (
            <View style={styles.askRow}>
              <TextInput
                value={ask}
                onChangeText={setAsk}
                multiline
                placeholder="AI에게 더 고쳐 달라고 하기 (예: 스터디 질문을 더 쉽게)"
                placeholderTextColor={colors.muted}
                accessibilityLabel="AI에게 고쳐 달라고 할 말"
                style={[styles.input, styles.inputSmall, styles.flex]}
              />
              <Pressable
                onPress={revise}
                disabled={!!busy || !ask.trim()}
                accessibilityRole="button"
                style={[styles.send, (!!busy || !ask.trim()) && styles.disabled]}
              >
                <Text style={styles.primaryText}>보내기</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={save}
            disabled={!!busy || !draft.trim()}
            accessibilityRole="button"
            style={[styles.primary, (!!busy || !draft.trim()) && styles.disabled]}
          >
            <Text style={styles.primaryText}>저장</Text>
          </Pressable>
          <Text style={styles.muted}>같은 주에 다시 저장하면 바꿔 써요.</Text>
        </Step>
      )}
    </ScrollView>
  );
}

function DraftView({
  draft,
  editing,
  onChange,
}: {
  draft: string;
  editing: boolean;
  onChange: (t: string) => void;
}) {
  const sections = splitSections(draft);
  const questions = studyQuestions(draft);
  return (
    <View style={styles.gap}>
      {editing ? (
        <TextInput
          value={draft}
          onChangeText={onChange}
          multiline
          placeholder="## 만든 것 …"
          placeholderTextColor={colors.muted}
          accessibilityLabel="개발일지 본문"
          style={styles.input}
        />
      ) : (
        <View style={styles.box}>
          {sections.map((s, i) => (
            <View key={`${i}-${s.title}`} style={styles.gapXs}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Markdown text={s.body} />
            </View>
          ))}
        </View>
      )}
      {draft.trim() !== '' && (
        <Text style={styles.muted}>
          섹션 {sections.length}개 · 스터디 질문 {questions.length}개
          {sections.length <= 1 ? ' · ## 제목이 없으면 한 덩어리로 저장돼요' : ''}
        </Text>
      )}
    </View>
  );
}

function KeyBox({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await saveAiKey(key);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <View style={styles.gap}>
      <Text style={styles.muted}>
        Claude API 키를 한 번 넣으면 이 폰의 보안 저장소에만 저장돼요. 서버로는 안 가요.
      </Text>
      <View style={styles.askRow}>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="sk-ant-…"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Claude API 키"
          style={[styles.input, styles.inputKey, styles.flex]}
        />
        <Pressable
          onPress={save}
          disabled={!key.trim()}
          accessibilityRole="button"
          style={[styles.send, !key.trim() && styles.disabled]}
        >
          <Text style={styles.primaryText}>저장</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function ManualAsk({ prompt }: { prompt: string }) {
  return (
    <View style={styles.gap}>
      <Text style={styles.muted}>
        아래 문장을 쓰는 코딩 AI(Claude Code, Codex 등)에 레포를 연 채로 넣고, 받은 답을 4번 칸에
        붙여 넣어요.
      </Text>
      <Text selectable style={styles.prompt}>
        {prompt}
      </Text>
      <Pressable
        onPress={() => Share.share({ message: prompt })}
        accessibilityRole="button"
        style={styles.secondary}
      >
        <Text style={styles.link}>문장 복사·보내기</Text>
      </Pressable>
    </View>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <View style={styles.gap}>
      <Text style={styles.stepTitle}>
        {n}. {title}
      </Text>
      {children}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  gapXs: { gap: space.xs },
  flex: { flex: 1 },
  stepTitle: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  askRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  error: { fontSize: fontSize.caption, color: '#C0392B' },
  sectionTitle: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  box: {
    gap: space.md,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    padding: space.sm,
    borderRadius: 12,
    backgroundColor: colors.accent,
    color: colors.surface,
    fontSize: fontSize.caption,
    overflow: 'hidden',
  },
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
  inputSmall: { minHeight: 64 },
  inputKey: { minHeight: 44 },
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
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  send: {
    minHeight: 44,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  primaryText: { fontSize: fontSize.body, fontWeight: '700', color: colors.surface },
});
