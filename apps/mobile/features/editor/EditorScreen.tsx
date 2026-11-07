import type { CalendarEvent, Document, Template } from '@noteapp/shared';
import { colors, fontSize, screen, space } from '@noteapp/ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listEventsForSlash, openDocument, saveDocument } from './data';
import { longDate, writingMethod } from './format';
import { buildSlashItems, findSlashQuery, type SlashItem } from './slash';
import { SlashMenu } from './SlashMenu';
import { Toolbar } from './Toolbar';

/** 하나로 된 단순 편집기. 지금은 양식에 상관없이 제목 + 본문 글 하나를 고쳐요. */
export function EditorScreen() {
  // 주소에서 값 꺼내기: /editor/doc-1 → id='doc-1', /editor/new?templateId=blog → 새 문서
  const { id, templateId } = useLocalSearchParams<{ id: string; templateId?: string }>();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [doc, setDoc] = useState<Document | null>(null);
  const [template, setTemplate] = useState<Template>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // 본문에서 커서 위치. 도구 막대 버튼이 이 자리에 글을 넣어요.
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [bodyFocused, setBodyFocused] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let alive = true; // 화면을 나간 뒤에 온 응답은 무시해요
    openDocument(id, templateId).then((result) => {
      if (!alive) return;
      if (!result) return setStatus('missing');
      setDoc(result.document);
      setTemplate(result.template);
      const end = result.document.body.length;
      setSelection({ start: end, end });
      setStatus('ready');
    });
    listEventsForSlash().then((list) => alive && setEvents(list));
    return () => {
      alive = false;
    };
  }, [id, templateId]);

  // 고칠 때마다 저장해요. (M1은 메모리에만)
  useEffect(() => {
    if (doc) void saveDocument(doc);
  }, [doc]);

  if (status !== 'ready' || !doc) {
    return (
      <View style={[screen.container, styles.center]}>
        <Text style={styles.meta}>
          {status === 'loading' ? '불러오는 중' : '문서를 찾지 못했어요'}
        </Text>
      </View>
    );
  }

  function edit(patch: Partial<Pick<Document, 'title' | 'body'>>) {
    setDoc((d) => d && { ...d, ...patch, updatedAt: new Date().toISOString() });
  }

  /** 커서 자리(또는 from부터 커서까지)를 text로 바꾸고 커서를 그 뒤로 옮겨요. */
  function insert(text: string, from = selection.start) {
    if (!doc) return;
    const body = doc.body.slice(0, from) + text + doc.body.slice(selection.end);
    const cursor = from + text.length;
    edit({ body });
    setSelection({ start: cursor, end: cursor });
    // 글이 화면에 그려진 다음에 커서를 옮겨야 해서 한 박자 늦춰요.
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelection(cursor, cursor);
    });
  }

  const before = doc.body[selection.start - 1]; // 커서 바로 앞 글자
  const atLineStart = before === undefined || before === '\n';

  const slash = bodyFocused ? findSlashQuery(doc.body, selection.start) : null;
  const slashItems = slash ? buildSlashItems(slash.query, events, new Date()) : [];

  function pickSlash(item: SlashItem) {
    if (slash && item.insert !== null) insert(item.insert, slash.start);
  }

  function share() {
    if (!doc) return;
    void Share.share({ title: doc.title, message: `${doc.title}\n\n${doc.body}` });
  }

  return (
    <KeyboardAvoidingView
      style={screen.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          title: `${template?.name ?? '문서'} 세션`,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="공유"
              hitSlop={10}
              onPress={share}
            >
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={22}
                tintColor={colors.ink}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={screen.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TextInput
            value={doc.title}
            onChangeText={(title) => edit({ title })}
            placeholder="제목"
            placeholderTextColor={colors.muted}
            style={styles.title}
          />
          <Text style={styles.meta}>
            {longDate(doc.createdAt)} · {writingMethod(doc)}
          </Text>
          <View style={styles.divider} />
          <TextInput
            ref={bodyRef}
            value={doc.body}
            onChangeText={(body) => edit({ body })}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder="자유롭게 써요. / 를 치면 명령이 나와요."
            placeholderTextColor={colors.muted}
            multiline
            scrollEnabled={false} // 바깥 ScrollView가 스크롤해요
            textAlignVertical="top"
            style={styles.body}
          />
        </View>
      </ScrollView>

      {slash && <SlashMenu items={slashItems} onPick={pickSlash} />}

      <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.surface }}>
        <Toolbar
          onSlash={() => insert(before && !/\s/.test(before) ? ' /' : '/')}
          onMic={() => Alert.alert('녹음', '음성 메모는 나중에 붙여요.')}
          onAi={() =>
            Alert.alert('AI로 다듬기', 'AI 초안 기능(B)과 이어지면 여기서 글을 다듬어요.')
          }
          onPhoto={() => Alert.alert('사진 넣기', '사진 첨부는 나중에 붙여요.')}
          onCheckbox={() => insert(atLineStart ? '- [ ] ' : '\n- [ ] ')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: space.md,
    gap: space.xs,
    ...Platform.select({
      android: { elevation: 2 },
      default: {
        shadowColor: '#1D2533',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  title: { fontSize: fontSize.heading, fontWeight: '700', color: colors.ink, padding: 0 },
  meta: { fontSize: fontSize.caption, color: colors.muted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: space.sm,
  },
  body: { minHeight: 320, fontSize: fontSize.body, lineHeight: 24, color: colors.ink, padding: 0 },
});
