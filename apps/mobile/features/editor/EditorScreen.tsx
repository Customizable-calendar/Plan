import type { CalendarEvent, Document, Template } from '@noteapp/shared';
import { Icon, palette, SaveStatus, Text } from '@noteapp/ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { EyeIcon, PencilIcon, ShareIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listEventsForSlash, openDocument, saveDocument } from './data';
import { FormatBar } from './FormatBar';
import { longDate, savedTime, writingMethod } from './format';
import { insertLineAfter, lastFilledLine, lineText } from './blocks';
import {
  applyLineFormat,
  formatAtCursor,
  type LineFormat,
  lineFormatOf,
  linePrefix,
} from './markdown';
import { Preview } from './Preview';
import { buildSlashItems, findSlashQuery, type SlashItem } from './slash';
import { SlashMenu } from './SlashMenu';
import { Toolbar } from './Toolbar';

// 처음부터 꾸민 모양(미리보기)으로 여는 양식 분류. 칸이 많은 양식은 마크다운보다 표와 제목으로 보는 게 쉬워요.
const PREVIEW_FIRST: ReadonlySet<string> = new Set(['research']);

/** 편집기: 상자 없는 흰 바탕, 상단바 양식 이름, 제목 아래 상태 칩, 키보드 위 서식 막대 */
export function EditorScreen() {
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
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [bodyFocused, setBodyFocused] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // 미리보기에서 커서를 옮길 줄과, 마지막으로 누른 줄
  const [previewFocus, setPreviewFocus] = useState<number | null>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const bodyRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let alive = true;
    openDocument(id, templateId, seed).then((result) => {
      if (!alive) return;
      if (!result) return setStatus('missing');
      setDoc(result.document);
      if (seed) setDirty(true);
      setTemplate(result.template);
      const category = result.template?.category;
      setPreviewing(category !== undefined && PREVIEW_FIRST.has(category));
      const end = result.document.body.length;
      setSelection({ start: end, end });
      setStatus('ready');
    });
    listEventsForSlash().then((list) => alive && setEvents(list));
    return () => {
      alive = false;
    };
  }, [id, templateId, seed]);

  useEffect(() => {
    if (doc && dirty) void saveDocument(doc);
  }, [doc, dirty]);

  if (status !== 'ready' || !doc) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted-foreground">
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

  async function saveNow() {
    if (!doc) return;
    await saveDocument(doc);
    setDirty(true);
    setSavedAt(new Date());
  }

  function format(kind: LineFormat) {
    if (!doc) return;
    if (previewing) return addPreviewLine(kind);
    const next = applyLineFormat(doc.body, selection.start, kind);
    edit({ body: next.body });
    setSelection({ start: next.start, end: next.end });
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelection(next.start, next.end);
    });
  }

  /** 미리보기에서 서식 버튼: 마지막으로 누른 줄 아래(없으면 맨 끝)에 그 서식의 빈 줄을 넣고 커서를 둬요. */
  function addPreviewLine(kind: LineFormat) {
    if (!doc) return;
    const after = activeLine ?? lastFilledLine(doc.body);
    const body = insertLineAfter(doc.body, after, linePrefix(kind, lineText(doc.body, after)));
    edit({ body });
    setActiveLine(after + 1);
    setPreviewFocus(after + 1);
  }

  function insert(text: string, from = selection.start) {
    if (!doc) return;
    const body = doc.body.slice(0, from) + text + doc.body.slice(selection.end);
    const cursor = from + text.length;
    edit({ body });
    setSelection({ start: cursor, end: cursor });
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelection(cursor, cursor);
    });
  }

  const before = doc.body[selection.start - 1];
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

  const saveState = savedAt ? 'saved' : dirty ? 'editing' : 'local';
  // 서식 막대에 지금 줄의 서식을 표시해요. 미리보기에서는 마지막으로 누른 줄이에요.
  const activeFormat = previewing
    ? activeLine === null
      ? null
      : (lineFormatOf(lineText(doc.body, activeLine))?.format ?? null)
    : bodyFocused
      ? formatAtCursor(doc.body, selection.start)
      : null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          title: template?.name ?? '문서',
          headerRight: () => (
            <View className="mr-2 flex-row items-center gap-3">
              <SaveStatus state={saveState} onPress={() => void saveNow()} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={previewing ? '편집으로 돌아가기' : '미리보기'}
                hitSlop={10}
                onPress={() => setPreviewing((on) => !on)}
              >
                <Icon
                  as={previewing ? PencilIcon : EyeIcon}
                  size={20}
                  className="text-foreground"
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="공유"
                hitSlop={10}
                onPress={share}
              >
                <Icon as={ShareIcon} size={20} className="text-foreground" />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-12 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={doc.title}
          onChangeText={(title) => edit({ title })}
          placeholder="제목"
          placeholderTextColor={palette.mutedForeground}
          className="p-0 text-2xl font-bold tracking-tight text-foreground"
        />
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-muted px-2.5 py-0.5">
            <Text className="text-xs text-muted-foreground">{longDate(doc.createdAt)}</Text>
          </View>
          <View className="rounded-full bg-muted px-2.5 py-0.5">
            <Text className="text-xs text-muted-foreground">{writingMethod(doc)}</Text>
          </View>
          {savedAt ? (
            <Text className="text-xs text-muted-foreground">{savedTime(savedAt)} 저장됨</Text>
          ) : null}
        </View>
        <View className="my-1 h-px bg-border" />
        {previewing ? (
          <Preview
            body={doc.body}
            onChange={(body) => edit({ body })}
            focusLine={previewFocus}
            onFocusLine={setPreviewFocus}
            onActiveLine={setActiveLine}
          />
        ) : (
          <TextInput
            ref={bodyRef}
            value={doc.body}
            onChangeText={(body) => edit({ body })}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder="자유롭게 써 보세요"
            placeholderTextColor={palette.mutedForeground}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            className="min-h-[320px] p-0 text-base leading-7 text-foreground"
          />
        )}
      </ScrollView>

      {!previewing && slash ? <SlashMenu items={slashItems} onPick={pickSlash} /> : null}

      <FormatBar onFormat={format} active={activeFormat} />
      <View className="bg-background" style={{ paddingBottom: insets.bottom }}>
        {!previewing ? (
          <Toolbar
            onSlash={() => insert(before && !/\s/.test(before) ? ' /' : '/')}
            onMic={() => router.push('/stt')}
            onAi={() => router.push('/draft')}
            onPhoto={() => Alert.alert('사진 넣기', '사진 첨부는 나중에 붙여요.')}
            onCheckbox={() => insert(atLineStart ? '- [ ] ' : '\n- [ ] ')}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
