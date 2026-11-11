import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { NoteGrid } from './NoteGrid';
import { QuickNoteInput } from './QuickNoteInput';
import { useNotes } from './useNotes';

/** 메모 화면: 위에는 막 쓰기 입력, 아래에는 최근 메모를 두 칸으로 쌓아 보여줘요. */
export function NotesScreen() {
  const { notes, loading, error, addNote } = useNotes();

  return (
    // KeyboardAvoidingView: 키보드가 올라오면 입력창이 가려지지 않게 화면을 밀어 올려요.
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <QuickNoteInput onSaved={addNote} />
        <Text className="text-[13px] font-semibold text-muted-foreground">최근 메모</Text>
        {loading ? (
          <Text className="text-[13px] text-muted-foreground">불러오는 중</Text>
        ) : error ? (
          <Text className="text-[13px] text-destructive">{error}</Text>
        ) : notes.length === 0 ? (
          <Text className="text-[13px] text-muted-foreground">아직 쓴 메모가 없어요.</Text>
        ) : (
          <NoteGrid notes={notes} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
