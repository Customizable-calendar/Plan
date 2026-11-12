import { ScrollView, Pressable, Text, View } from 'react-native';

import { formatTime } from './format';
import { useTrash } from './useNotes';

/** 휴지통: 왼쪽으로 넘긴 메모를 모아 둬요. 되돌리거나 완전히 지울 수 있어요. */
export function TrashScreen() {
  const { trash, restore, erase } = useTrash();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-2 p-4 pb-10">
      {trash.length === 0 ? (
        <Text className="text-center text-[13px] text-muted-foreground">휴지통이 비어 있어요.</Text>
      ) : (
        trash.map(({ note, trashedAt }) => (
          <View key={note.id} className="gap-2 rounded-lg border border-border bg-card p-3">
            <Text className="text-[15px] leading-6 text-card-foreground">{note.text}</Text>
            <Text className="text-[11px] text-muted-foreground">
              쓴 시각 {formatTime(note.createdAt)}, 버린 시각 {formatTime(trashedAt)}
            </Text>
            <View className="flex-row justify-end gap-2">
              <Pressable
                onPress={() => erase(note.id)}
                accessibilityRole="button"
                className="h-8 justify-center rounded-md px-3 active:bg-muted"
              >
                <Text className="text-[13px] font-semibold text-destructive">완전히 지우기</Text>
              </Pressable>
              <Pressable
                onPress={() => restore(note.id)}
                accessibilityRole="button"
                className="h-8 justify-center rounded-md bg-primary px-3"
              >
                <Text className="text-[13px] font-semibold text-primary-foreground">되돌리기</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
