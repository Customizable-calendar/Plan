import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { parseBlocks, type PreviewBlock } from './blocks';

// 제목 크기는 디자인 시스템 글자 종류(h2, h3, h4)를 따라요.
const HEADING_CLASS = {
  1: 'mt-4 border-b border-border pb-2 text-2xl font-semibold tracking-tight text-foreground',
  2: 'mt-4 border-b border-border pb-1.5 text-xl font-semibold tracking-tight text-foreground',
  3: 'mt-2 text-lg font-semibold tracking-tight text-foreground',
} as const;

/** 본문을 꾸며서 보여주는 읽기 전용 화면. 고치려면 편집으로 돌아가요. */
export function Preview({ body }: { body: string }) {
  const blocks = parseBlocks(body);

  if (blocks.length === 0) {
    return <Text className="text-sm text-muted-foreground">아직 쓴 내용이 없어요.</Text>;
  }

  return (
    <View className="gap-2">
      {blocks.map((block, index) => (
        // 블록은 순서가 바뀌지 않는 읽기 전용 목록이라 index를 key로 써요.
        <Block key={index} block={block} />
      ))}
    </View>
  );
}

/** 비어 있는 칸에 보여주는 흐린 글자 */
function Empty() {
  return <Text className="text-base text-muted-foreground">값 없음</Text>;
}

function Block({ block }: { block: PreviewBlock }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Text accessibilityRole="header" className={HEADING_CLASS[block.level]}>
          {block.text}
        </Text>
      );

    case 'fields':
      return (
        <View className="rounded-lg border border-border">
          {block.rows.map((row, index) => (
            <View
              key={index}
              className={`flex-row gap-3 px-3 py-2 ${index > 0 ? 'border-t border-border' : ''}`}
            >
              <Text className="w-24 text-sm leading-6 text-muted-foreground">{row.label}</Text>
              <View className="flex-1">
                {row.value ? (
                  <Text className="text-base leading-6 text-foreground">{row.value}</Text>
                ) : (
                  <Empty />
                )}
              </View>
            </View>
          ))}
        </View>
      );

    case 'bullet':
      return (
        <View className="flex-row gap-2 pl-1">
          <View className="mt-2.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <Text className="flex-1 text-base leading-6 text-foreground">{block.text}</Text>
        </View>
      );

    case 'check':
      return (
        <View className="flex-row gap-2">
          <SymbolView
            name={
              block.checked
                ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' }
                : {
                    ios: 'square',
                    android: 'check_box_outline_blank',
                    web: 'check_box_outline_blank',
                  }
            }
            size={22}
            tintColor={block.checked ? palette.primary : palette.mutedForeground}
          />
          <Text
            className={`flex-1 text-base leading-6 ${
              block.checked ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {block.text}
          </Text>
        </View>
      );

    case 'number':
      return (
        <View className="flex-row gap-2 pl-1">
          <Text className="text-base leading-6 text-muted-foreground">{block.order}.</Text>
          <Text className="flex-1 text-base leading-6 text-foreground">{block.text}</Text>
        </View>
      );

    case 'quote':
      return (
        <View className="border-l-2 border-border pl-3">
          {block.text ? (
            <Text className="text-base italic leading-6 text-foreground">{block.text}</Text>
          ) : (
            <Empty />
          )}
        </View>
      );

    case 'paragraph':
      return <Text className="text-base leading-7 text-foreground">{block.text}</Text>;
  }
}
