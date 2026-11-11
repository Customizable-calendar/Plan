import { useRef } from 'react';
import { ScrollView, type ScrollViewInstance, Text, View } from 'react-native';

import { formatClock, formatDay, groupByDay } from './log';
import { useNotes } from './useNotes';

/**
 * 막 쓰기 기록: 카카오톡 "나에게 보내기"처럼 쓴 메모를 시간 순서대로 쌓아 보여줘요.
 * 날짜는 하루에 한 번만 가운데에 보여주고, 메모마다 쓴 시각을 옆에 붙여요.
 * 가장 최근 메모가 맨 아래에 있어서, 화면을 열면 맨 아래로 내려가요.
 */
export function MemoLogScreen() {
  const { notes, loading, error } = useNotes();
  // useRef: 다시 그려져도 유지되는 상자예요. 여기서는 스크롤 화면을 가리켜 맨 아래로 내릴 때 써요.
  const scrollRef = useRef<ScrollViewInstance>(null);

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 p-4 pb-10"
      // 내용 높이가 정해지면(처음 불러왔을 때) 가장 최근 메모가 보이게 맨 아래로 내려요.
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
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
              // 내가 보낸 말풍선처럼 오른쪽에 붙이고, 시각은 말풍선 왼쪽 아래에 둬요.
              <View key={note.id} className="flex-row items-end justify-end gap-1.5">
                <Text className="text-[11px] text-muted-foreground">
                  {formatClock(note.createdAt)}
                </Text>
                {/* shrink: 글이 길면 화면 밖으로 나가지 않고 말풍선 안에서 줄을 바꿔요. */}
                <View className="max-w-[80%] shrink rounded-2xl rounded-br-sm bg-bubble-user px-3.5 py-2.5">
                  <Text className="text-[15px] leading-6 text-bubble-user-foreground">
                    {note.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}
