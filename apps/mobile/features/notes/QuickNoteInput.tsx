import type { Note } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { saveNote } from './data';

interface Props {
  /** 저장한 뒤 할 일. 글을 돌려주면 입력창 아래에 안내로 보여줘요. */
  onSaved?: (note: Note) => Promise<string | void> | void;
  autoFocus?: boolean;
}

/**
 * 막 쓰기 입력창: 글쓰기와 저장만 있어요.
 * 리마인드, 공동 작업자, 해시태그, 체크리스트는 메모 화면에서 기록을 꾹 누르면 정해요.
 */
export function QuickNoteInput({ onSaved, autoFocus }: Props) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = text.trim().length > 0;

  const submit = async () => {
    try {
      const note = await saveNote({ text });
      setText('');
      setError(null);
      setMessage((await onSaved?.(note)) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-2 rounded-lg border border-border bg-card p-4 pb-2">
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus={autoFocus}
        placeholder="생각나는 대로 적어 보세요"
        placeholderTextColor={palette.mutedForeground}
        accessibilityLabel="메모 입력"
        textAlignVertical="top"
        className="min-h-24 text-base leading-6 text-foreground"
      />

      <View className="flex-row items-center gap-2 border-t border-border pt-2">
        <Text
          className={`flex-1 text-[13px] ${error ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {error ?? message}
        </Text>
        <Pressable
          onPress={submit}
          disabled={!canSave}
          accessibilityRole="button"
          className={`h-9 justify-center rounded-md bg-primary px-4 ${canSave ? '' : 'opacity-40'}`}
        >
          <Text className="text-sm font-semibold text-primary-foreground">저장</Text>
        </Pressable>
      </View>
    </View>
  );
}
