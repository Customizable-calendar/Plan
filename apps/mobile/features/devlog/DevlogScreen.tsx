import { colors, fontSize, screen, space } from '@noteapp/ui';
import { Link } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Markdown } from './Markdown';
import { memberOf, members } from './members';
import { splitSections, STUDY_TITLE, studyQuestions } from './parse';
import { type Devlog, useDevlogs } from './store';
import { shiftWeek, weekKey, weekLabel } from './week';

type Mode = 'logs' | 'study';

export function DevlogScreen() {
  const { logs, loading } = useDevlogs();
  const [week, setWeek] = useState(() => weekKey(new Date()));
  const [mode, setMode] = useState<Mode>('logs');
  const thisWeek = weekKey(new Date());

  const weekLogs = members.flatMap((m) =>
    logs.filter((l) => l.week === week && l.author === m.role),
  );
  const missing = members.filter((m) => !weekLogs.some((l) => l.author === m.role));

  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      <View style={styles.weekRow}>
        <Pressable
          onPress={() => setWeek(shiftWeek(week, -1))}
          accessibilityRole="button"
          accessibilityLabel="지난 주"
          hitSlop={8}
        >
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <View style={styles.weekCenter}>
          <Text style={styles.weekTitle}>{weekLabel(week)}</Text>
          {week === thisWeek && <Text style={styles.muted}>이번 주</Text>}
        </View>
        <Pressable
          onPress={() => setWeek(shiftWeek(week, 1))}
          disabled={week >= thisWeek}
          accessibilityRole="button"
          accessibilityLabel="다음 주"
          hitSlop={8}
        >
          <Text style={[styles.arrow, week >= thisWeek && styles.off]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Chip label="일지" on={mode === 'logs'} onPress={() => setMode('logs')} />
        <Chip label={STUDY_TITLE} on={mode === 'study'} onPress={() => setMode('study')} />
        <View style={styles.flex} />
        <Link href="/devlog-new" style={styles.link}>
          일지 쓰기
        </Link>
      </View>

      {loading && <Text style={styles.muted}>불러오는 중</Text>}
      {!loading && missing.length > 0 && (
        <Text style={styles.muted}>아직 안 쓴 사람: {missing.map((m) => m.name).join(', ')}</Text>
      )}

      {mode === 'logs' ? (
        weekLogs.map((log) => <LogCard key={log.id} log={log} />)
      ) : (
        <StudyView logs={weekLogs} />
      )}
    </ScrollView>
  );
}

function LogCard({ log }: { log: Devlog }) {
  const m = memberOf(log.author);
  return (
    <Box>
      <Text style={styles.author}>
        {m.name}{' '}
        <Text style={styles.muted}>
          · {m.role} {m.area}
        </Text>
      </Text>
      {splitSections(log.body)
        .filter((s) => !s.title.includes(STUDY_TITLE))
        .map((s, i) => (
          <View key={`${i}-${s.title}`} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Markdown text={s.body} />
          </View>
        ))}
    </Box>
  );
}

/** 회의에서 쓰는 화면: 질문만 먼저 보고, 답은 눌러서 열어요. */
function StudyView({ logs }: { logs: Devlog[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const items = logs.flatMap((log) =>
    studyQuestions(log.body).map((q, i) => ({ ...q, key: `${log.id}-${i}`, author: log.author })),
  );
  if (items.length === 0) return <Text style={styles.muted}>이 주에는 스터디 질문이 없어요.</Text>;

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <>
      {items.map((q, i) => {
        const shown = open.has(q.key);
        return (
          <Box key={q.key}>
            <Text style={styles.muted}>
              {i + 1}번 · {memberOf(q.author).name}
            </Text>
            <Text style={styles.question}>{q.question}</Text>
            {q.answer && (
              <Pressable onPress={() => toggle(q.key)} accessibilityRole="button">
                <Text style={styles.link}>{shown ? '답 닫기' : '답 보기'}</Text>
              </Pressable>
            )}
            {shown && q.answer && <Markdown text={q.answer} />}
          </Box>
        );
      })}
    </>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <View style={styles.box}>{children}</View>;
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
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekCenter: { alignItems: 'center' },
  weekTitle: { fontSize: fontSize.title, fontWeight: '700', color: colors.ink },
  arrow: { fontSize: 32, lineHeight: 36, paddingHorizontal: space.md, color: colors.ink },
  off: { color: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  link: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  box: {
    gap: space.md,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  author: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  section: { gap: space.xs },
  sectionTitle: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  question: { fontSize: fontSize.body, fontWeight: '600', lineHeight: 24, color: colors.ink },
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
});
