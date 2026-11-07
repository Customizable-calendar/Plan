import type { AiRequest } from '@noteapp/ai-client';
import { templates } from '@noteapp/shared';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardDetail, typeLabel, useCards } from '@/features/cards';

import { getProvider } from './data';
import { buildRequest } from './prompt';

type Result = { text: string; request: AiRequest };

export function DraftScreen() {
  const { cards, loading } = useCards();
  const [templateId, setTemplateId] = useState(templates[0].id);
  // 확인한 카드는 기본으로 모두 보내요. 뺀 카드만 기억해요.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const confirmed = cards.filter((c) => c.status === 'confirmed');
  const selected = confirmed.filter((c) => !excluded.has(c.id));

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const generate = async () => {
    const request = buildRequest(template, selected);
    setBusy(true);
    setError(null);
    try {
      const provider = await getProvider();
      setResult({ text: await provider.complete(request), request });
      setShowRequest(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const blocked = busy || selected.length === 0;

  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      <Section title="양식">
        <View style={styles.row}>
          {templates.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              on={t.id === templateId}
              onPress={() => setTemplateId(t.id)}
            />
          ))}
        </View>
        <Text style={styles.muted}>{template.description}</Text>
      </Section>

      <Section title={`보낼 카드 ${selected.length}/${confirmed.length}`}>
        {loading && <Text style={styles.muted}>불러오는 중</Text>}
        {!loading && confirmed.length === 0 && (
          <Text style={styles.muted}>확인한 카드가 없어요. 카드 탭에서 먼저 확인해 주세요.</Text>
        )}
        {confirmed.map((c) => {
          const on = !excluded.has(c.id);
          const detail = cardDetail(c);
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.pick, on && styles.pickOn]}
            >
              <View style={[styles.check, on && styles.checkOn]}>
                {on && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.pickBody}>
                <Text style={styles.type}>{typeLabel[c.type]}</Text>
                <Text style={styles.pickTitle}>{c.title}</Text>
                {detail && <Text style={styles.muted}>{detail}</Text>}
              </View>
            </Pressable>
          );
        })}
      </Section>

      <Pressable
        onPress={generate}
        disabled={blocked}
        accessibilityRole="button"
        style={[styles.primary, blocked && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryText}>{result ? '다시 만들기' : '초안 만들기'}</Text>
        )}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <Section title="초안 미리보기">
          <View style={styles.doc}>
            <Markdown text={result.text} />
          </View>
          <Pressable onPress={() => setShowRequest((v) => !v)} accessibilityRole="button">
            <Text style={styles.link}>
              {showRequest ? '보낸 내용 닫기' : '보낸 내용 보기'} ·{' '}
              {(result.request.system?.length ?? 0) + result.request.prompt.length}자
            </Text>
          </Pressable>
          {showRequest && (
            <Text style={styles.request}>
              {result.request.system}
              {'\n\n'}
              {result.request.prompt}
            </Text>
          )}
          {/* TODO(B, M2): 편집기(A)가 열리면 Document로 넘겨요. */}
        </Section>
      )}
    </ScrollView>
  );
}

/** 초안 미리보기용 최소 마크다운: ## 제목, - 목록, 나머지는 문단 */
function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return (
            <Text key={i} style={[styles.h2, i > 0 && styles.h2Gap]}>
              {line.slice(3)}
            </Text>
          );
        if (line.startsWith('- '))
          return (
            <Text key={i} style={styles.body}>
              {'• '}
              {line.slice(2)}
            </Text>
          );
        return line.trim() ? (
          <Text key={i} style={styles.body}>
            {line}
          </Text>
        ) : null;
      })}
    </>
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
  section: { gap: space.sm },
  sectionTitle: { fontSize: fontSize.caption, fontWeight: '700', color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  muted: { fontSize: fontSize.caption, color: colors.muted },
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
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pickOn: { borderColor: colors.accent },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { fontSize: 14, fontWeight: '700', color: colors.surface },
  pickBody: { flex: 1, gap: 2 },
  type: { fontSize: fontSize.caption, fontWeight: '700', color: colors.accent },
  pickTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.ink },
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
  doc: {
    gap: space.xs,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  h2: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  h2Gap: { marginTop: space.sm },
  body: { fontSize: fontSize.body, lineHeight: 24, color: colors.ink },
  link: { fontSize: fontSize.caption, fontWeight: '600', color: colors.accent },
  request: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    padding: space.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
});
