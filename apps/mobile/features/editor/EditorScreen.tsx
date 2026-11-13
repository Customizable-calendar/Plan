import type { CalendarEvent, Document, Template } from '@noteapp/shared';
import { colors, fontSize, radius, screen, space } from '@noteapp/ui';
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
import { FormatBar } from './FormatBar';
import { longDate, savedTime, writingMethod } from './format';
import { applyLineFormat, type LineFormat } from './markdown';
import { Preview } from './Preview';
import { buildSlashItems, findSlashQuery, type SlashItem } from './slash';
import { SlashMenu } from './SlashMenu';
import { Toolbar } from './Toolbar';

/** 하나로 된 단순 편집기. 지금은 양식에 상관없이 제목 + 본문 글 하나를 고쳐요. */
export function EditorScreen() {
  // 주소에서 값 꺼내기: /editor/doc-1 → id='doc-1', /editor/new?templateId=blog → 새 문서
  // seed: 미완성 세션에서 왔으면 메모 원문이에요. 새 문서 맨 위에 들어가요.
  const { id, templateId, seed } = useLocalSearchParams<{
    id: string;
    templateId?: string;
    seed?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [doc, setDoc] = useState<Document | null>(null);
  const [template, setTemplate] = useState<Template>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // 본문에서 커서 위치. 도구 막대 버튼이 이 자리에 글을 넣어요.
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [bodyFocused, setBodyFocused] = useState(false);
  // 한 번이라도 고쳤는지, 마지막으로 '저장'을 누른 시각
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // 미리보기: 본문의 마크다운 기호를 제목, 표, 체크 모양으로 꾸며서 보여주고, 그 자리에서 고칠 수 있어요.
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let alive = true; // 화면을 나간 뒤에 온 응답은 무시해요
    openDocument(id, templateId, seed).then((result) => {
      if (!alive) return;
      if (!result) return setStatus('missing');
      setDoc(result.document);
      // 메모 원문이 들어간 새 문서는 바로 저장해요. 안 고치고 나가도 메모가 사라지지 않게요.
      if (seed) setDirty(true);
      setTemplate(result.template);
      const end = result.document.body.length;
      setSelection({ start: end, end });
      setStatus('ready');
    });
    listEventsForSlash().then((list) => alive && setEvents(list));
    return () => {
      alive = false;
    };
  }, [id, templateId, seed]);

  // 고칠 때마다 저장해요. (M1은 메모리에만) 열기만 하고 안 고친 새 문서는 저장하지 않아요.
  useEffect(() => {
    if (doc && dirty) void saveDocument(doc);
  }, [doc, dirty]);

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
    setDirty(true);
    setSavedAt(null);
  }

  /** 헤더의 '저장(임시)'. M1은 앱이 켜져 있는 동안만 기억해요. */
  async function saveNow() {
    if (!doc) return;
    await saveDocument(doc);
    setDirty(true);
    setSavedAt(new Date());
  }

  /** 서식 막대: 커서가 있는 줄 맨 앞에 서식 머리를 붙여요. */
  function format(kind: LineFormat) {
    if (!doc) return;
    const next = applyLineFormat(doc.body, selection.start, kind);
    edit({ body: next.body });
    setSelection({ start: next.cursor, end: next.cursor });
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelection(next.cursor, next.cursor);
    });
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
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={previewing ? '편집으로 돌아가기' : '미리보기'}
                hitSlop={10}
                onPress={() => setPreviewing((on) => !on)}
              >
                <SymbolView
                  name={
                    previewing
                      ? { ios: 'pencil', android: 'edit', web: 'edit' }
                      : { ios: 'eye', android: 'visibility', web: 'visibility' }
                  }
                  size={22}
                  tintColor={colors.ink}
                />
              </Pressable>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="임시 저장"
                hitSlop={8}
                onPress={saveNow}
                style={styles.saveButton}
              >
                <Text style={styles.saveText}>저장(임시)</Text>
              </Pressable>
            </View>
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
            {savedAt ? `, ${savedTime(savedAt)} 임시 저장됨` : ''}
          </Text>
          <View style={styles.divider} />
          {previewing ? (
            <Preview body={doc.body} onChange={(body) => edit({ body })} />
          ) : (
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
          )}
        </View>
      </ScrollView>

      {!previewing && slash && <SlashMenu items={slashItems} onPick={pickSlash} />}

      {!previewing && <FormatBar onFormat={format} />}
      <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.surface }}>
        {!previewing && (
          <Toolbar
            onSlash={() => insert(before && !/\s/.test(before) ? ' /' : '/')}
            onMic={() => Alert.alert('녹음', '음성 메모는 나중에 붙여요.')}
            onAi={() =>
              Alert.alert('AI로 다듬기', 'AI 초안 기능(B)과 이어지면 여기서 글을 다듬어요.')
            }
            onPhoto={() => Alert.alert('사진 넣기', '사진 첨부는 나중에 붙여요.')}
            onCheckbox={() => insert(atLineStart ? '- [ ] ' : '\n- [ ] ')}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // marginRight: 웹 헤더에서는 오른쪽 끝에 딱 붙어서 여백을 줘요.
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginRight: space.sm,
  },
  saveButton: {
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveText: { fontSize: fontSize.caption, fontWeight: '700', color: colors.primaryForeground },
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
