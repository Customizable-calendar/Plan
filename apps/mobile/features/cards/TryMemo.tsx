import { Button, palette, Text } from '@noteapp/ui';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { addFromText } from './store';

// 카드 탭에서 바로 메모를 넣어 보는 상자 없는 빠른 입력 칸이에요. (디자인 시스템 redesign 빠른 입력)
export function TryMemo() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const memo = text.trim();
    if (!memo) return;
    try {
      const count = (await addFromText(memo)).length;
      setMessage(count ? `카드 ${count}장을 찾았어요.` : '찾은 카드가 없어요.');
      if (count) setText('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-2 border-b border-border pb-3">
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'메모를 써 보세요\n예: 내일 3시 민수랑 회의. 견적서 보내야 함'}
        placeholderTextColor={palette.mutedForeground}
        accessibilityLabel="메모"
        className="min-h-[64px] text-base leading-6 text-foreground"
        textAlignVertical="top"
      />
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-xs text-muted-foreground">{message ?? ''}</Text>
        <Button size="sm" disabled={!text.trim()} onPress={() => void submit()}>
          <Text>카드 찾기</Text>
        </Button>
      </View>
    </View>
  );
}
