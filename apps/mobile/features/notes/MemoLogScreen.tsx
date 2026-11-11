import type { Note } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';

import { formatReminder, formatTime } from './format';
import { formatClock, formatDay, groupByDay } from './log';
import { SwipeRow } from './SwipeRow';
import {
  Avatar,
  CollaboratorSheet,
  HashtagSheet,
  Option,
  ReminderBadge,
  ReminderSheet,
  Sheet,
} from './ToolSheets';
import { useImportantNotes, useNotes } from './useNotes';

type SheetKind = 'menu' | 'reminder' | 'collaborator' | 'hashtag';

/**
 * 메모 화면: 맨 위에 "중요한 메모", 그 아래에 막 쓰기 기록을 쌓아 보여줘요.
 * 기록은 카카오톡 "나에게 보내기"처럼 날짜는 하루에 한 번, 메모는 시간 순서로 쌓여요.
 * 말풍선을 꾹 누르면 메뉴가 나와요. 왼쪽으로 넘기면 휴지통, 오른쪽으로 넘기면 미완성 세션으로 보내요.
 */
export function MemoLogScreen() {
  const { notes, loading, error, update, trash, toChecklist, toSession } = useNotes();
  const { important, isImportant, toggle, remove, reload } = useImportantNotes();
  // 꾹 누른 메모와, 지금 열린 팝업
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
          꾹 누르면 메뉴가 나와요. 왼쪽으로 넘기면 휴지통, 오른쪽으로 넘기면 세션으로 가요.
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
                <SwipeRow
                  key={note.id}
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
                    onLongPress={() => {
                      setTarget(note);
                      setSheet('menu');
                    }}
                  />
                </SwipeRow>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* 꾹 누르면 나오는 메뉴 */}
      <Sheet visible={sheet === 'menu'} title="메모 설정" onClose={close}>
        <Option
          label="리마인드"
          sub={target?.reminder ? formatReminder(target.reminder) : '알림 시각 정하기'}
          onPress={() => setSheet('reminder')}
        />
        <Option
          label="공동 작업자"
          sub={
            target?.collaborators?.length ? target.collaborators.join(', ') : '함께 볼 사람 추가'
          }
          onPress={() => setSheet('collaborator')}
        />
        <Option label="해시태그" sub="글 끝에 태그 붙이기" onPress={() => setSheet('hashtag')} />
        <Option
          label="체크리스트로 만들기"
          sub="기록에서 빼서 막 쓰기 아래로 옮겨요"
          onPress={() => {
            if (target) void toChecklist(target);
            close();
          }}
        />
        <Option
          label="세션으로 보내기"
          sub="기록에서 빼서 미완성 세션으로 만들어요"
          onPress={() => {
            if (target) void toSession(target);
            close();
          }}
        />
        <Option
          label="휴지통으로 보내기"
          onPress={() => {
            if (target) void trash(target);
            close();
          }}
        />
      </Sheet>
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

/** 기록 한 줄: 내가 보낸 말풍선처럼 오른쪽에 붙이고, 왼쪽에 별과 시각을 둬요. */
function LogBubble({
  note,
  important,
  onToggle,
  onLongPress,
}: {
  note: Note;
  important: boolean;
  onToggle: () => void;
  onLongPress: () => void;
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
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={note.text}
        accessibilityHint="꾹 누르면 리마인드, 공동 작업자, 해시태그, 체크리스트 메뉴가 나와요"
        className="max-w-[80%] shrink gap-1.5 rounded-2xl rounded-br-sm bg-bubble-user px-3.5 py-2.5 active:opacity-80"
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
