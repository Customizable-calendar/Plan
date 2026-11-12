import type { Note } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { Link } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';

import { formatTime } from './format';
import { formatClock, formatDay, groupByDay } from './log';
import { SwipeRow } from './SwipeRow';
import {
  Avatar,
  CollaboratorSheet,
  HashtagSheet,
  ReminderBadge,
  ReminderSheet,
} from './ToolSheets';
import { useImportantNotes, useNotes } from './useNotes';

type SheetKind = 'reminder' | 'collaborator' | 'hashtag';

/**
 * 메모 화면: 맨 위에 "중요한 메모", 그 아래에 막 쓰기 기록을 쌓아 보여줘요.
 * 기록은 카카오톡 "나에게 보내기"처럼 날짜는 하루에 한 번, 메모는 시간 순서로 쌓여요.
 * 말풍선을 꾹 누르면 바로 위에 아이콘 막대가 떠요. 왼쪽으로 넘기면 휴지통, 오른쪽으로 넘기면 미완성 세션으로 보내요.
 */
export function MemoLogScreen() {
  const { notes, loading, error, update, trash, toChecklist, toSession } = useNotes();
  const { important, isImportant, toggle, remove, reload } = useImportantNotes();
  // 아이콘 막대를 띄운 메모 id, 설정 중인 메모, 지금 열린 팝업
  const [activeId, setActiveId] = useState<string | null>(null);
  const [target, setTarget] = useState<Note | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  // useRef: 다시 그려져도 유지되는 상자예요. 여기서는 스크롤 화면을 가리켜 맨 아래로 내릴 때 써요.
  const scrollRef = useRef<ScrollViewInstance>(null);

  const close = () => setSheet(null);
  // 메모를 고치면 중요한 메모에 들어 있는 복사본도 바뀌어서 다시 불러와요.
  const save = async (note: Note) => {
    setTarget(note);
    await update(note);
    reload();
  };
  // 태그는 사용자가 고른 것만, 글 끝에 붙여요.
  const addTag = (tag: string) => {
    if (target) void save({ ...target, text: `${target.text} ${tag}` });
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        contentContainerClassName="gap-3 p-4 pb-10"
        // 내용 높이가 정해지면(처음 불러왔을 때) 가장 최근 메모가 보이게 맨 아래로 내려요.
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <ImportantSection notes={important} onRemove={remove} />

        <View className="flex-row items-baseline justify-between">
          <Text className="text-[13px] font-semibold text-muted-foreground">기록</Text>
          <Link href="/notes-trash" className="text-[13px] font-bold text-primary">
            휴지통
          </Link>
        </View>
        <Text className="text-[12px] text-muted-foreground">
          꾹 누르면 설정 아이콘이 나와요. 왼쪽으로 넘기면 휴지통, 오른쪽으로 넘기면 세션으로 가요.
        </Text>
        {loading ? (
          <Text className="text-center text-[13px] text-muted-foreground">불러오는 중</Text>
        ) : error ? (
          <Text className="text-center text-[13px] text-destructive">{error}</Text>
        ) : notes.length === 0 ? (
          <Text className="text-center text-[13px] text-muted-foreground">
            아직 쓴 메모가 없어요. 막 쓰기에 적으면 여기에 쌓여요.
          </Text>
        ) : (
          groupByDay(notes).map((day) => (
            <View key={day.key} className="gap-2">
              {/* 날짜 구분: 하루에 한 번만 */}
              <View className="self-center rounded-full bg-muted px-3 py-1">
                <Text className="text-[12px] text-muted-foreground">
                  {formatDay(day.notes[0].createdAt)}
                </Text>
              </View>

              {day.notes.map((note) => (
                <View key={note.id} className="gap-1">
                  {activeId === note.id ? (
                    <ActionBar
                      onClose={() => setActiveId(null)}
                      onAction={(action) => {
                        setActiveId(null);
                        setTarget(note);
                        if (action === 'checklist') void toChecklist(note);
                        else if (action === 'session') void toSession(note);
                        else if (action === 'trash') void trash(note);
                        else setSheet(action);
                      }}
                    />
                  ) : null}
                  <SwipeRow
                    left={{
                      label: '휴지통으로',
                      icon: { ios: 'trash', android: 'delete', web: 'delete' },
                      run: () => void trash(note),
                    }}
                    right={{
                      label: '세션으로',
                      icon: { ios: 'folder', android: 'folder', web: 'folder' },
                      run: () => void toSession(note),
                    }}
                  >
                    <LogBubble
                      note={note}
                      important={isImportant(note.id)}
                      onToggle={() => toggle(note)}
                      active={activeId === note.id}
                      onLongPress={() => setActiveId(note.id)}
                      onPress={() => setActiveId(null)}
                    />
                  </SwipeRow>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <ReminderSheet
        visible={sheet === 'reminder'}
        current={target?.reminder}
        onPick={(reminder) => {
          if (!target) return;
          // 리마인드를 지우면 키를 아예 빼요.
          const { reminder: _old, ...rest } = target;
          void save(reminder ? { ...rest, reminder } : rest);
        }}
        onClose={close}
      />
      <CollaboratorSheet
        visible={sheet === 'collaborator'}
        emails={target?.collaborators ?? []}
        onChange={(collaborators) => target && void save({ ...target, collaborators })}
        onClose={close}
      />
      <HashtagSheet visible={sheet === 'hashtag'} onPick={addTag} onClose={close} />
    </>
  );
}

/** 중요한 메모: 지우기 전까지 남아 있어요. */
function ImportantSection({ notes, onRemove }: { notes: Note[]; onRemove: (id: string) => void }) {
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold text-muted-foreground">중요한 메모</Text>
      {notes.length === 0 ? (
        <Text className="text-[13px] text-muted-foreground">
          기록에서 별을 누르면 여기에 남아요. 지우기 전까지 사라지지 않아요.
        </Text>
      ) : (
        notes.map((note) => (
          <View
            key={note.id}
            className="flex-row items-start gap-2 rounded-lg border border-border bg-card p-3"
          >
            <View className="flex-1 gap-1">
              <Text className="text-[15px] leading-6 text-card-foreground">{note.text}</Text>
              <Text className="text-[11px] text-muted-foreground">
                {formatTime(note.createdAt)}
              </Text>
            </View>
            <Pressable
              onPress={() => onRemove(note.id)}
              accessibilityRole="button"
              accessibilityLabel="중요한 메모에서 지우기"
              hitSlop={8}
              className="h-7 w-7 items-center justify-center rounded-full active:bg-muted"
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                tintColor={palette.mutedForeground}
              />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

type ActionKind = SheetKind | 'checklist' | 'session' | 'trash';

// 꾹 누르면 말풍선 위에 뜨는 아이콘들. 글자는 화면 읽기 기능(accessibilityLabel)에만 써요.
const ACTIONS: { kind: ActionKind; label: string; icon: SymbolViewProps['name'] }[] = [
  {
    kind: 'reminder',
    label: '리마인드',
    icon: { ios: 'bell', android: 'notifications', web: 'notifications' },
  },
  {
    kind: 'collaborator',
    label: '공동 작업자',
    icon: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  },
  { kind: 'hashtag', label: '해시태그', icon: { ios: 'number', android: 'tag', web: 'tag' } },
  {
    kind: 'checklist',
    label: '체크리스트로 만들기',
    icon: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  },
  {
    kind: 'session',
    label: '세션으로 보내기',
    icon: { ios: 'folder', android: 'folder', web: 'folder' },
  },
  {
    kind: 'trash',
    label: '휴지통으로 보내기',
    icon: { ios: 'trash', android: 'delete', web: 'delete' },
  },
];

/** 꾹 누른 말풍선 바로 위에 뜨는 작은 아이콘 막대 */
function ActionBar({
  onAction,
  onClose,
}: {
  onAction: (kind: ActionKind) => void;
  onClose: () => void;
}) {
  return (
    <View
      accessibilityRole="toolbar"
      className="flex-row items-center gap-0.5 self-end rounded-full border border-border bg-popover px-1 py-0.5 shadow-sm"
    >
      {ACTIONS.map((a) => (
        <Pressable
          key={a.kind}
          onPress={() => onAction(a.kind)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          hitSlop={4}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <SymbolView
            name={a.icon}
            size={18}
            tintColor={a.kind === 'trash' ? palette.destructive : palette.foreground}
          />
        </Pressable>
      ))}
      <View className="mx-0.5 h-5 w-px bg-border" />
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="닫기"
        hitSlop={4}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
      >
        <SymbolView
          name={{ ios: 'xmark', android: 'close', web: 'close' }}
          size={16}
          tintColor={palette.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

/** 기록 한 줄: 내가 보낸 말풍선처럼 오른쪽에 붙이고, 왼쪽에 별과 시각을 둬요. */
function LogBubble({
  note,
  important,
  active,
  onToggle,
  onLongPress,
  onPress,
}: {
  note: Note;
  important: boolean;
  /** 아이콘 막대가 떠 있는 말풍선이면 테두리로 표시해요. */
  active: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onPress: () => void;
}) {
  const people = note.collaborators ?? [];
  return (
    <View className="flex-row items-end justify-end gap-1.5">
      <View className="items-end gap-0.5">
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={important ? '중요 표시 끄기' : '중요한 메모에 넣기'}
          accessibilityState={{ selected: important }}
          hitSlop={8}
          className="h-7 w-7 items-center justify-center rounded-full active:bg-muted"
        >
          <SymbolView
            name={{
              ios: important ? 'star.fill' : 'star',
              android: 'star',
              web: 'star',
            }}
            size={16}
            tintColor={important ? palette.primary : palette.mutedForeground}
          />
        </Pressable>
        <Text className="text-[11px] text-muted-foreground">{formatClock(note.createdAt)}</Text>
      </View>
      {/* shrink: 글이 길면 화면 밖으로 나가지 않고 말풍선 안에서 줄을 바꿔요. */}
      <Pressable
        onLongPress={onLongPress}
        onPress={onPress}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={note.text}
        accessibilityHint="꾹 누르면 리마인드, 공동 작업자, 해시태그 같은 설정 아이콘이 나와요"
        className={`max-w-[80%] shrink gap-1.5 rounded-2xl rounded-br-sm bg-bubble-user px-3.5 py-2.5 active:opacity-80 ${
          active ? 'border-2 border-ring' : ''
        }`}
      >
        <Text className="text-[15px] leading-6 text-bubble-user-foreground">{note.text}</Text>
        {note.reminder || people.length ? (
          <View className="flex-row flex-wrap items-center gap-1">
            {note.reminder ? <ReminderBadge reminder={note.reminder} /> : null}
            {people.map((e) => (
              <Avatar key={e} email={e} size="sm" />
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
