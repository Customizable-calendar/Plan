import { palette } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, ScrollView, Text } from 'react-native';

import type { LineFormat } from './markdown';

interface FormatButton {
  format: LineFormat;
  label: string;
  /** 글자로 보여줄 버튼 (H1, H2) */
  text?: string;
  icon?: SymbolViewProps['name'];
}

const BUTTONS: FormatButton[] = [
  { format: 'h1', label: '제목 1', text: 'H1' },
  { format: 'h2', label: '제목 2', text: 'H2' },
  {
    format: 'check',
    label: '체크리스트',
    icon: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  },
  {
    format: 'bullet',
    label: '글머리 기호',
    icon: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' },
  },
  {
    format: 'quote',
    label: '인용',
    icon: { ios: 'text.quote', android: 'format_quote', web: 'format_quote' },
  },
];

/** 본문 위 서식 막대. 누르면 커서가 있는 줄 맨 앞에 마크다운 머리를 붙이거나 떼요. */
export function FormatBar({ onFormat }: { onFormat: (format: LineFormat) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always" // 키보드가 열린 채로 눌러도 바로 동작해요
      contentContainerClassName="gap-1 px-2 py-1.5"
      className="grow-0 border-t border-border bg-card"
    >
      {BUTTONS.map((b) => (
        <Pressable
          key={b.format}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          onPress={() => onFormat(b.format)}
          className="h-9 min-w-11 items-center justify-center rounded-md px-2 active:bg-muted"
        >
          {b.text ? (
            <Text className="text-[15px] font-bold text-foreground">{b.text}</Text>
          ) : b.icon ? (
            <SymbolView name={b.icon} size={20} tintColor={palette.foreground} />
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
