import type { Note } from '@noteapp/shared';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { QuickNoteInput } from './QuickNoteInput';

interface Props {
  /** 저장한 뒤 이어서 할 일. 카드 탭에서는 카드 찾기를 넘겨요. 돌려준 글은 입력칸 아래에 보여요. */
  onSaved?: (text: string) => Promise<string | void>;
  /** 더는 쓰지 않아요. 최근 메모는 메모 화면(/notes)에서만 봐요. 카드 탭이 넘기고 있어서 남겨 뒀어요. */
  showRecent?: boolean;
  /** 화면이 열리면 바로 입력할 수 있게 */
  autoFocus?: boolean;
}

/** 막 쓰기 입력 + 메모 화면 입구. 카드 탭이 맨 위에 붙여요. 저장한 메모는 메모 화면에 쌓여요. */
export function QuickNoteSection({ onSaved, autoFocus }: Props) {
  const handleSaved = (note: Note) => onSaved?.(note.text);

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-xl font-bold text-foreground">막 쓰기</Text>
        {/* 중요한 메모와 기록을 함께 보는 곳. 입력칸 아래에 계속 보이지 않게 따로 열어요. */}
        <Link href="/notes" className="text-[13px] font-bold text-primary">
          메모 모두 보기
        </Link>
      </View>
      <QuickNoteInput onSaved={handleSaved} autoFocus={autoFocus} />
    </View>
  );
}
