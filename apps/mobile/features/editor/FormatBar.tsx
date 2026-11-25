import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
  /** 막대 오른쪽 끝에 고정해 둘 버튼 (예: AI). 서식 버튼은 옆으로 넘겨도 이 버튼은 그대로예요. */
  trailing?: ReactNode;
  /** false면 서식 버튼을 숨기고 오른쪽 버튼만 둬요. 미리보기에서는 서식 버튼이 필요 없어요. */
  showFormats?: boolean;
}

/**
 * 본문 아래 서식 막대.
 * 편집에서 커서가 있는 줄 맨 앞에 머리를 붙이거나 떼요. 미리보기에서는 서식 버튼을 숨겨요.
 */
export function FormatBar({ onFormat, active, trailing, showFormats = true }: Props) {
  return (
    <View className="flex-row items-center justify-end border-t border-border bg-card">
      {showFormats ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always" // 키보드가 열린 채로 눌러도 바로 동작해요
          contentContainerClassName="gap-1 px-2 py-1.5"
          className="flex-1"
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
      ) : null}
      {trailing ? (
        <View className={showFormats ? 'border-l border-border px-1' : 'px-1'}>{trailing}</View>
      ) : null}
    </View>
  );
}
