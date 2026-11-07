import type { Template } from '@noteapp/shared';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type SessionItem, listMySessions, listTemplates } from './data';
import { shortDate } from './format';
import { cardStyle, look } from './look';

/** 편집기로 이동. 문서가 있으면 그 문서를, 없으면 양식으로 새 문서를 열어요. */
function openEditor(documentId: string | null, templateId: string) {
  if (documentId) router.push({ pathname: '/editor/[id]', params: { id: documentId } });
  else router.push({ pathname: '/editor/[id]', params: { id: 'new', templateId } });
}

export function SessionsScreen() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // '+ 새 세션'을 누르면 양식 고르기 칸으로 스크롤해요. ref = 화면 요소를 직접 가리키는 손잡이
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [templatesY, setTemplatesY] = useState(0);

  useEffect(() => {
    Promise.all([listMySessions(), listTemplates()])
      .then(([s, t]) => {
        setSessions(s);
        setTemplates(t);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView ref={scrollRef} style={screen.container} contentContainerStyle={screen.content}>
      {/* 화면 위 제목 줄. 뒤로 가기는 기본 헤더 것을 그대로 써요. */}
      <Stack.Screen
        options={{
          title: '세션',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => scrollRef.current?.scrollTo({ y: templatesY, animated: true })}
              hitSlop={8}
              style={styles.newButton}
            >
              <Text style={styles.newButtonText}>+ 새 세션</Text>
            </Pressable>
          ),
        }}
      />

      <Text style={styles.sectionTitle}>내 세션</Text>
      {loading ? (
        <Text style={styles.muted}>불러오는 중</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.muted}>아직 세션이 없어요. 아래에서 양식을 골라 시작해요.</Text>
      ) : (
        <View style={styles.list}>
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </View>
      )}

      <View onLayout={(e) => setTemplatesY(e.nativeEvent.layout.y)}>
        <Text style={styles.sectionTitle}>새 세션 · 템플릿 고르기</Text>
      </View>
      <View style={styles.grid}>
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert('AI로 새 양식 만들기', '이 기능은 나중에(P1) 만들어요.')}
        style={({ pressed }) => [styles.aiButton, pressed && styles.pressed]}
      >
        <Text style={styles.aiButtonText}>✨ AI로 새 양식 만들기</Text>
      </Pressable>
    </ScrollView>
  );
}

function SessionRow({ session }: { session: SessionItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.title} 세션 열기`}
      onPress={() => openEditor(session.lastDocumentId, session.templateId)}
      style={({ pressed }) => [cardStyle.card, styles.row, pressed && styles.pressed]}
    >
      {/* 양식 이름 첫 글자로 만든 동그란 표시 */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{session.templateName.slice(0, 1)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{session.title}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {session.lastDocumentTitle ?? '아직 쓴 문서가 없어요'} · {shortDate(session.updatedAt)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.name} 양식으로 새로 쓰기`}
      onPress={() => openEditor(null, template.id)}
      style={({ pressed }) => [cardStyle.card, styles.templateCard, pressed && styles.pressed]}
    >
      <Text style={styles.rowTitle}>{template.name}</Text>
      <Text style={styles.muted} numberOfLines={2}>
        {template.description}
      </Text>
      <Text style={styles.sectionCount}>{template.sections.length}개 칸</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.ink,
    marginTop: space.sm,
  },
  muted: { fontSize: fontSize.caption, color: colors.muted },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.body, fontWeight: '700', color: colors.ink },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: look.primarySoft,
  },
  badgeText: { fontSize: fontSize.body, fontWeight: '700', color: colors.accent },
  chevron: { fontSize: 24, color: colors.muted },
  // 두 칸 격자: 줄바꿈(flexWrap)하면서 한 칸이 절반보다 조금 작게
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  templateCard: { width: '48.5%', minHeight: 120, padding: space.md, gap: space.xs },
  sectionCount: {
    marginTop: 'auto',
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.accent,
  },
  aiButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: look.radius,
    paddingVertical: space.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  aiButtonText: { fontSize: fontSize.body, fontWeight: '700', color: colors.accent },
  newButton: { paddingHorizontal: space.sm },
  newButtonText: { fontSize: fontSize.body, fontWeight: '700', color: colors.accent },
  pressed: { opacity: 0.6 },
});
