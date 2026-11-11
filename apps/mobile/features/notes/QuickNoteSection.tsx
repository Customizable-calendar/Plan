import type { Note } from '@noteapp/shared';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { NoteGrid } from './NoteGrid';
import { QuickNoteInput } from './QuickNoteInput';
import { useNotes } from './useNotes';

// 최근 메모를 몇 개까지 보여줄지
const LIMIT = 4;

interface Props {
  /** 저장한 뒤 이어서 할 일. 카드 탭에서는 카드 찾기를 넘겨요. 돌려준 글은 입력칸 아래에 보여요. */
  onSaved?: (text: string) => Promise<string | void>;
  /** 최근 메모 목록을 보여줄지 */
  showRecent?: boolean;
  /** 화면이 열리면 바로 입력할 수 있게 */
  autoFocus?: boolean;
}

/** 막 쓰기 입력 + 최근 메모 몇 개 + 메모 화면 입구. 카드 탭이 맨 위에 붙여요. */
export function QuickNoteSection({ onSaved, showRecent = true, autoFocus }: Props) {
  const { notes, loading, error, addNote } = useNotes();

  const handleSaved = (note: Note) => {
    addNote(note); // 새 메모를 목록 맨 위에 붙여요
    return onSaved?.(note.text);
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-xl font-bold text-foreground">막 쓰기</Text>
        <View className="flex-row gap-3">
          {/* 저장한 메모를 시간 순서로 쌓아 보는 곳. 입력칸 아래에 계속 보이지 않게 따로 열어요. */}
          <Link href="/notes-log" className="text-[13px] font-bold text-primary">
            기록 보기
          </Link>
          <Link href="/notes" className="text-[13px] font-bold text-primary">
            메모 모두 보기
          </Link>
        </View>
      </View>
      <QuickNoteInput
        onSaved={handleSaved}
        saveLabel={onSaved ? '저장하고 카드 찾기' : '저장'}
        autoFocus={autoFocus}
      />

      {!showRecent ? null : (
        <>
          <Text className="text-[13px] font-semibold text-muted-foreground">최근 메모</Text>
          {loading ? (
            <Text className="text-[13px] text-muted-foreground">불러오는 중</Text>
          ) : error ? (
            <Text className="text-[13px] text-destructive">{error}</Text>
          ) : notes.length === 0 ? (
            <Text className="text-[13px] text-muted-foreground">아직 쓴 메모가 없어요.</Text>
          ) : (
            <NoteGrid notes={notes.slice(0, LIMIT)} />
          )}
        </>
      )}
    </View>
  );
}
