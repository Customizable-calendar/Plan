import { Pressable, ScrollView, Text } from 'react-native';

import type { LineFormat } from './markdown';

// 마크다운 기호와 이름을 함께 보여줘요. 기호를 외우지 않아도 눌러서 넣을 수 있어요.
const BUTTONS: { format: LineFormat; symbol: string; label: string }[] = [
  { format: 'h1', symbol: '#', label: '제목 1' },
  { format: 'h2', symbol: '##', label: '제목 2' },
  { format: 'h3', symbol: '###', label: '제목 3' },
  { format: 'bullet', symbol: '-', label: '글머리' },
  { format: 'number', symbol: '1.', label: '번호' },
  { format: 'check', symbol: '[ ]', label: '체크' },
  { format: 'quote', symbol: '>', label: '인용' },
  { format: 'field', symbol: '이름:', label: '항목' },
];

interface Props {
  onFormat: (format: LineFormat) => void;
  /** 지금 줄의 서식. 그 버튼을 눌린 모양으로 보여줘요. */
  active?: LineFormat | null;
}

/**
 * 본문 아래 서식 막대.
 * 편집에서는 커서가 있는 줄 맨 앞에 머리를 붙이거나 떼고, 미리보기에서는 그 서식의 새 줄을 넣어요.
 */
export function FormatBar({ onFormat, active }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always" // 키보드가 열린 채로 눌러도 바로 동작해요
      contentContainerClassName="gap-1 px-2 py-1.5"
      className="grow-0 border-t border-border bg-card"
    >
      {BUTTONS.map((b) => {
        const on = active === b.format;
        return (
          <Pressable
            key={b.format}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            accessibilityState={{ selected: on }}
            onPress={() => onFormat(b.format)}
            className={`h-12 min-w-14 items-center justify-center rounded-md px-2 ${
              on ? 'bg-accent' : 'active:bg-muted'
            }`}
          >
            <Text
              className={`text-[15px] font-bold ${
                on ? 'text-accent-foreground' : 'text-foreground'
              }`}
            >
              {b.symbol}
            </Text>
            <Text className="text-[11px] text-muted-foreground">{b.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
