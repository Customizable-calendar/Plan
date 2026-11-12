import { colors, fontSize, screen, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AiMessage,
  AiText,
  ErrorNotice,
  hasAiKey,
  look,
  memberOf,
  members,
  type Role,
  Thinking,
  useDevlogs,
  weekKey,
  weekLabel,
} from '@/features/devlog';

import { gradeQuiz, makeQuiz, POINTS, type Question } from './quiz';
import { type Rank, rankBoard } from './rank';
import { type QuizResult, resultOf, saveQuizResult, useQuizResults } from './store';
import { useMyTeamRole } from '@/lib/auth';

// 개발 기간 이벤트: 본인 일지로 AI가 낸 퀴즈를 풀고 빌보드에 순위가 박제돼요.
// 출시 빌드에는 안 보여요(index.ts). 출시 전에 이 폴더째 지워요(README).

type Phase =
  | { kind: 'board' }
  | { kind: 'quiz'; author: Role; questions: Question[]; answers: string[] }
  | { kind: 'result'; result: QuizResult };

export function DevquizScreen() {
  const results = useQuizResults();
  const { logs } = useDevlogs();
  const week = weekKey(new Date());
  const [scope, setScope] = useState<'week' | 'all'>('week');
  // 고르기 전에는 로그인한 팀원 본인으로 둬요. (Supabase에서는 내 이름으로만 쓸 수 있어요)
  const myRole = useMyTeamRole();
  const [pickedAuthor, setAuthor] = useState<Role | null>(null);
  const author: Role = pickedAuthor ?? myRole ?? 'B';
  const [phase, setPhase] = useState<Phase>({ kind: 'board' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyReady, setKeyReady] = useState<boolean | null>(null);

  useEffect(() => {
    hasAiKey().then(setKeyReady, () => setKeyReady(false));
  }, []);

  const log = logs.find((l) => l.week === week && l.author === author);
  const done = resultOf(author, week);
  const board = rankBoard(results, scope === 'week' ? week : 'all');

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

  const start = () =>
    run('일지를 읽고 문제 내는 중', async () => {
      if (!log) return;
      const questions = await makeQuiz(memberOf(author), log.body);
      setPhase({ kind: 'quiz', author, questions, answers: questions.map(() => '') });
    });

  const submit = (p: Extract<Phase, { kind: 'quiz' }>) =>
    run('채점하는 중', async () => {
      if (!log) return;
      const graded = await gradeQuiz(log.body, p.questions, p.answers);
      await saveQuizResult({ author: p.author, week, ...graded });
      const saved = resultOf(p.author, week);
      if (saved) setPhase({ kind: 'result', result: saved });
    });

  if (phase.kind === 'quiz') {
    const p = phase;
    const filled = p.answers.filter((a) => a.trim()).length;
    return (
      <ScrollView
        style={screen.container}
        contentContainerStyle={screen.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.muted}>
          {memberOf(p.author).name}의 {weekLabel(week)} 퀴즈 · 일지를 보지 말고 내 말로 써요
        </Text>
        {p.questions.map((q, i) => (
          <Box key={i}>
            <Text style={styles.qNum}>
              {i + 1}번 · {POINTS}점
            </Text>
            <Text style={styles.question}>{q.question}</Text>
            <TextInput
              value={p.answers[i]}
              onChangeText={(t) =>
                setPhase({ ...p, answers: p.answers.map((a, j) => (j === i ? t : a)) })
              }
              multiline
              placeholder="한두 문장으로"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`${i + 1}번 답`}
              style={styles.input}
            />
          </Box>
        ))}
        {busy && <Thinking label={busy} />}
        {error && <ErrorNotice message={error} action="다시 제출해 주세요" />}
        <Button
          label={`제출하기 (${filled}/${p.questions.length})`}
          onPress={() => submit(p)}
          disabled={!!busy}
        />
        <Text style={styles.muted}>한 번만 기록돼요. 빈칸은 0점이에요.</Text>
      </ScrollView>
    );
  }

  if (phase.kind === 'result') {
    return (
      <ScrollView style={screen.container} contentContainerStyle={screen.content}>
        <ResultView result={phase.result} />
        <Button label="빌보드로" onPress={() => setPhase({ kind: 'board' })} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>개발 기간 이벤트</Text>
        <Text style={styles.heroTitle}>공부 퀴즈 빌보드</Text>
        <Text style={styles.heroSub}>내 일지로 AI가 낸 문제를 풀어요. 결과는 박제돼요.</Text>
      </View>

      <View style={styles.row}>
        <Chip
          label={`이번 주 · ${weekLabel(week)}`}
          on={scope === 'week'}
          onPress={() => setScope('week')}
        />
        <Chip label="누적" on={scope === 'all'} onPress={() => setScope('all')} />
      </View>

      {board.ranks.length === 0 ? (
        <Text style={styles.muted}>아직 아무도 안 풀었어요. 1등 자리가 비어 있어요.</Text>
      ) : (
        board.ranks.map((r) => <RankRow key={r.member.role} rank={r} all={scope === 'all'} />)
      )}
      {board.missing.length > 0 && (
        <Text style={styles.muted}>안 푼 사람: {board.missing.map((m) => m.name).join(', ')}</Text>
      )}

      <Box>
        <Text style={styles.stepTitle}>내 퀴즈 풀기</Text>
        <View style={styles.row}>
          {members.map((m) => (
            <Chip
              key={m.role}
              label={m.name}
              on={author === m.role}
              onPress={() => {
                setAuthor(m.role);
                setError(null);
              }}
            />
          ))}
        </View>
        {done ? (
          <>
            <Text style={styles.muted}>이번 주는 이미 풀었어요 · {done.score}점</Text>
            <Pressable
              onPress={() => setPhase({ kind: 'result', result: done })}
              accessibilityRole="button"
            >
              <Text style={styles.link}>채점 결과 보기</Text>
            </Pressable>
          </>
        ) : !log ? (
          <>
            <Text style={styles.muted}>이번 주 일지가 있어야 문제를 낼 수 있어요.</Text>
            <Link href="/devlog-new" style={styles.link}>
              일지 쓰러 가기
            </Link>
          </>
        ) : keyReady === false ? (
          <>
            <Text style={styles.muted}>Claude 키가 필요해요. 일지 쓰기 화면에서 저장해요.</Text>
            <Link href="/devlog-new" style={styles.link}>
              키 저장하러 가기
            </Link>
          </>
        ) : (
          <Button
            label={`${memberOf(author).name} 퀴즈 시작 (${POINTS * 5}점 만점)`}
            onPress={start}
            disabled={!!busy || !keyReady}
          />
        )}
        {busy && <Thinking label={busy} />}
        {error && <ErrorNotice message={error} action="다시 해 주세요" />}
      </Box>
      <Text style={styles.muted}>
        지금은 이 폰에서 푼 결과만 보여요. 팀 전체 빌보드는 결과를 서버에 올리게 되면(M2) 같이 봐요.
      </Text>
    </ScrollView>
  );
}

function RankRow({ rank: r, all }: { rank: Rank; all: boolean }) {
  const top = r.title && r.rank === 1;
  const bottom = r.title && r.rank !== 1;
  return (
    <View style={[styles.rankRow, top && styles.rankTop, bottom && styles.rankBottom]}>
      <Text style={[styles.rankNum, top && styles.rankNumTop]}>{r.rank}</Text>
      <View style={styles.flex}>
        <Text style={styles.rankName}>
          {r.member.name} <Text style={styles.muted}>· {r.member.area}</Text>
        </Text>
        {r.title && (
          <Text style={[styles.rankTitle, bottom && styles.rankTitleBottom]}>{r.title}</Text>
        )}
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{r.score}</Text>
        <Text style={styles.muted}>{all ? `평균 · ${r.weeks}주` : '점'}</Text>
      </View>
    </View>
  );
}

function ResultView({ result }: { result: QuizResult }) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>
          {memberOf(result.author).name} · {weekLabel(result.week)}
        </Text>
        <Text style={styles.heroScore}>{result.score}점</Text>
        {result.comment !== '' && <Text style={styles.heroSub}>{result.comment}</Text>}
      </View>
      {result.answers.map((a, i) => (
        <Box key={i}>
          <Text style={styles.qNum}>
            {i + 1}번 · {a.score}/{POINTS}점
          </Text>
          <Text style={styles.question}>{a.question}</Text>
          <Text style={styles.answer}>{a.answer.trim() || '(비어 있음)'}</Text>
          {a.feedback !== '' && (
            <AiMessage>
              <AiText>{a.feedback}</AiText>
            </AiMessage>
          )}
        </Box>
      ))}
    </>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.primary, disabled && styles.disabled]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
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
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: look.primary },
  stepTitle: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  hero: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: look.radius,
    backgroundColor: colors.ink,
  },
  heroLabel: { fontSize: fontSize.caption, fontWeight: '700', color: look.primarySoft },
  heroTitle: { fontSize: fontSize.heading, fontWeight: '800', color: colors.surface },
  heroScore: { fontSize: 48, fontWeight: '800', color: colors.surface },
  heroSub: { fontSize: fontSize.caption, color: colors.line },
  box: {
    gap: space.sm,
    padding: space.md,
    borderRadius: look.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: look.radius,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rankTop: { borderColor: look.primary, borderWidth: 2, backgroundColor: look.primarySoft },
  rankBottom: { borderStyle: 'dashed', borderColor: look.destructive },
  rankNum: { width: 28, fontSize: fontSize.title, fontWeight: '800', color: colors.muted },
  rankNumTop: { color: look.primary },
  rankName: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  rankTitle: { fontSize: 12, fontWeight: '700', color: look.primary },
  rankTitleBottom: { color: look.destructive },
  scoreBox: { alignItems: 'flex-end' },
  score: { fontSize: fontSize.title, fontWeight: '800', color: colors.ink },
  qNum: { fontSize: fontSize.caption, fontWeight: '700', color: look.primary },
  question: { fontSize: fontSize.body, fontWeight: '600', lineHeight: 24, color: colors.ink },
  answer: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    color: colors.ink,
    padding: space.sm,
    borderRadius: look.radius - 4,
    backgroundColor: look.muted,
  },
  input: {
    minHeight: 72,
    padding: space.sm,
    borderRadius: look.radius - 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.background,
    fontSize: fontSize.body,
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
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: look.radius - 2,
    backgroundColor: look.primary,
  },
  disabled: { opacity: 0.4 },
  primaryText: { fontSize: fontSize.body, fontWeight: '700', color: colors.surface },
});
