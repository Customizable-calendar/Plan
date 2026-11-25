import type { CalendarEvent, Document, Template } from '@noteapp/shared';
import { Icon, palette, SaveStatus, Text } from '@noteapp/ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  EyeIcon,
  ImageIcon,
  PaperclipIcon,
  PencilIcon,
  ShareIcon,
  SparklesIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
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

import {
  fileUrl,
  filesAvailable,
  listEventsForSlash,
  openDocument,
  type Photo,
  saveDocument,
} from './data';
import { moveCursor, readCursor } from './cursor';
import { FormatBar } from './FormatBar';
import { longDate, savedTime, writingMethod } from './format';
import { insertLineAfter, lastFilledLine, lineText, photoSlot } from './blocks';
import {
  applyLineFormat,
  formatAtCursor,
  type LineFormat,
  lineFormatOf,
  linePrefix,
} from './markdown';
import { fileLine } from './paper';
import { PaperSheet } from './PaperSheet';
import { PhotoTray } from './PhotoTray';
import { Preview } from './Preview';
import { buildSlashItems, findSlashQuery, type SlashItem } from './slash';
import { SlashMenu } from './SlashMenu';
import { usePaper } from './usePaper';

// 처음부터 꾸민 모양(미리보기)으로 여는 양식 분류. 칸이 많은 양식은 마크다운보다 표와 제목으로 보는 게 쉬워요.
// 사진 포스트는 사진이 중심이라 사진이 보이는 미리보기로 열고, 사진함도 처음부터 열어 둬요. (양식 id 기준)
const PREVIEW_FIRST: ReadonlySet<string> = new Set(['research-paper', 'photo-post']);
const TRAY_FIRST: ReadonlySet<string> = new Set(['photo-post']);

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
  const [trayOpen, setTrayOpen] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let alive = true;
    openDocument(id, templateId, seed).then((result) => {
      if (!alive) return;
      if (!result) return setStatus('missing');
      setDoc(result.document);
      if (seed) setDirty(true);
      setTemplate(result.template);
      const templateKey = result.template?.id ?? '';
      setPreviewing(PREVIEW_FIRST.has(templateKey));
      setTrayOpen(TRAY_FIRST.has(templateKey));
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

  // 연구논문 문서의 논문 PDF (붙이기, 열기, 초록과 서론 뽑기)
  const paper = usePaper(doc?.body ?? '', (body) => {
    setDoc((d) => d && { ...d, body, updatedAt: new Date().toISOString() });
    setDirty(true);
    setSavedAt(null);
  });
  const isResearch = template?.category === 'research';

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
      moveCursor(bodyRef.current, next.start, next.end);
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
      moveCursor(bodyRef.current, cursor);
    });
  }

  /**
   * 사진함에서 고른 사진을 본문에 `![사진](file:<id>)` 한 줄로 넣어요.
   * 미리보기: 마지막으로 누른 줄 아래, 없으면 '## 사진', '## 대표 사진' 칸, 그것도 없으면 맨 끝.
   * 편집: 커서 자리에 한 줄로.
   */
  function insertPhoto(photo: Photo) {
    if (!doc) return;
    const line = fileLine('사진', photo.id);
    if (previewing) {
      const after = activeLine ?? photoSlot(doc.body) ?? lastFilledLine(doc.body);
      edit({ body: insertLineAfter(doc.body, after, line) });
      // 다음 사진은 이 사진 바로 아래에 들어가서, 이어진 사진은 옆으로 넘겨 보는 묶음이 돼요.
      setActiveLine(after + 1);
      return;
    }
    const before = doc.body[selection.start - 1];
    const next = doc.body[selection.end];
    const head = before === undefined || before === '\n' ? '' : '\n';
    const tail = next === undefined || next === '\n' ? '' : '\n';
    insert(`${head}${line}${tail}`);
  }

  const slash = bodyFocused ? findSlashQuery(doc.body, selection.start) : null;
  const slashItems = slash ? buildSlashItems(slash.query, events, new Date()) : [];

  function pickSlash(item: SlashItem) {
    if (!slash || item.insert === null) return;
    // 목록 줄(- 일정:, - [ ])은 줄 처음에 있어야 해서, 글 중간에서 고르면 새 줄로 넣어요.
    const midLine = slash.start > 0 && doc?.body[slash.start - 1] !== '\n';
    const text = midLine && item.insert.startsWith('- ') ? `\n${item.insert}` : item.insert;
    insert(text, slash.start);
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
              {isResearch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="논문 PDF 붙이기"
                  hitSlop={10}
                  onPress={() => void paper.attach()}
                >
                  <Icon as={PaperclipIcon} size={20} className="text-foreground" />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={trayOpen ? '사진함 닫기' : '내 사진함 열기'}
                accessibilityState={{ expanded: trayOpen }}
                hitSlop={10}
                onPress={() => setTrayOpen((open) => !open)}
              >
                <Icon
                  as={ImageIcon}
                  size={20}
                  className={trayOpen ? 'text-primary' : 'text-foreground'}
                />
              </Pressable>
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
          className="p-0 text-2xl font-bold tracking-tight text-foreground web:outline-none"
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
            onFile={(fileId, action) => void paper.onFile(fileId, action)}
            imageUrl={filesAvailable ? fileUrl : undefined}
          />
        ) : (
          <TextInput
            ref={bodyRef}
            value={doc.body}
            onChangeText={(body) => {
              // 웹은 글자를 칠 때 onSelectionChange가 안 와서 // 명령이 안 떴어요. 웹만 커서 위치를 직접 읽어요.
              // 앱은 onSelectionChange가 제대로 와서 그대로 둬요.
              const at = readCursor(bodyRef.current);
              if (at !== null) setSelection({ start: at, end: at });
              edit({ body });
            }}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            onFocus={() => setBodyFocused(true)}
            // 명령 목록을 누르면 본문 칸 포커스가 먼저 빠져요. 바로 닫으면 누른 항목이 안 들어가서 조금 뒤에 닫아요.
            onBlur={() => setTimeout(() => setBodyFocused(false), 250)}
            placeholder="자유롭게 써 보세요. // 를 치면 일정을 넣을 수 있어요."
            placeholderTextColor={palette.mutedForeground}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            // 웹 입력칸은 내용만큼 늘어나지 않아 안에서 스크롤되고 아래가 비어 보여요. field-sizing으로 늘려요.
            // 글 쓰는 칸이라 브라우저가 그리는 굵은 테두리(outline)는 빼요. 커서로 위치가 보여요.
            className="min-h-[320px] p-0 text-base leading-7 text-foreground web:outline-none web:[field-sizing:content]"
          />
        )}
      </ScrollView>

      {!previewing && slash ? <SlashMenu items={slashItems} onPick={pickSlash} /> : null}

      {trayOpen ? <PhotoTray onClose={() => setTrayOpen(false)} onPick={insertPhoto} /> : null}
      {/* 아래에는 서식 막대 한 줄만 둬요. 일정은 본문에 // 를 쳐서, 사진은 위 헤더에서 넣어요. */}
      <View className="bg-card" style={{ paddingBottom: insets.bottom }}>
        <FormatBar
          onFormat={format}
          active={activeFormat}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="AI로 초안 만들기"
              onPress={() => router.push('/draft')}
              className="h-12 w-12 items-center justify-center rounded-md active:bg-muted"
            >
              <Icon as={SparklesIcon} size={20} className="text-primary" />
            </Pressable>
          }
        />
      </View>
      <PaperSheet
        state={paper.sheet}
        error={paper.error}
        notice={paper.notice}
        onApply={paper.apply}
        onClose={paper.close}
      />
    </KeyboardAvoidingView>
  );
}
