import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, View } from 'react-native';

import {
  insertLineAfter,
  type LinePart,
  nextPrefix,
  parseBlocks,
  type PreviewBlock,
  removeLine,
  replaceLine,
} from './blocks';

// 제목 크기는 디자인 시스템 글자 종류(h2, h3, h4)를 따라요.
const HEADING_CLASS = {
  1: 'text-2xl font-semibold tracking-tight text-foreground',
  2: 'text-xl font-semibold tracking-tight text-foreground',
  3: 'text-lg font-semibold tracking-tight text-foreground',
} as const;

interface Props {
  body: string;
  /** 고친 본문 전체를 돌려줘요. */
  onChange: (body: string) => void;
}

/**
 * 본문을 꾸며서 보여주는 화면. 글자를 누르면 그 자리에서 바로 고칠 수 있어요.
 * 고친 글은 본문의 그 줄에만 반영돼요. 새 제목이나 문단을 넣으려면 편집으로 돌아가요.
 */
export function Preview({ body, onChange }: Props) {
  const blocks = parseBlocks(body);
  // 엔터로 새 줄을 만들거나 줄을 지운 뒤 커서를 둘 줄
  const [focusLine, setFocusLine] = useState<number | null>(null);

  if (blocks.length === 0) {
    return <Text className="text-sm text-muted-foreground">아직 쓴 내용이 없어요.</Text>;
  }

  /** 줄 하나를 고칠 때 쓰는 입력칸 속성을 만들어요. */
  function lineProps(part: LinePart, block: PreviewBlock) {
    return {
      value: part.text,
      focused: focusLine === part.line,
      onFocused: () => setFocusLine(null),
      onText: (text: string) => onChange(replaceLine(body, part.line, part.prefix + text)),
      // 목록에서 엔터: 커서 뒤 글을 새 항목으로 내려요. 목록이 아니면 줄을 나누지 않아요.
      onEnter: (before: string, after: string) => {
        const prefix = nextPrefix(block);
        if (prefix === null) {
          onChange(replaceLine(body, part.line, part.prefix + before + after));
          return;
        }
        const kept = replaceLine(body, part.line, part.prefix + before);
        onChange(insertLineAfter(kept, part.line, prefix + after));
        setFocusLine(part.line + 1);
      },
      // 빈 목록 항목에서 지우기: 그 줄을 없애고 윗줄로 가요.
      onDeleteEmpty: () => {
        if (nextPrefix(block) === null) return;
        onChange(removeLine(body, part.line));
        setFocusLine(part.line - 1);
      },
    };
  }

  function renderBlock(block: PreviewBlock) {
    switch (block.kind) {
      case 'heading':
        return (
          <View className={`border-border pb-1.5 ${block.level < 3 ? 'mt-4 border-b' : 'mt-2'}`}>
            <LineInput {...lineProps(block, block)} className={HEADING_CLASS[block.level]} />
          </View>
        );

      case 'fields':
        return (
          <View className="rounded-lg border border-border">
            {block.rows.map((row, index) => (
              <View
                key={row.line}
                className={`flex-row gap-3 px-3 py-2 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <Text className="w-24 text-sm leading-6 text-muted-foreground">{row.label}</Text>
                <LineInput
                  {...lineProps(row, block)}
                  placeholder="값 없음"
                  className="flex-1 text-base leading-6 text-foreground"
                />
              </View>
            ))}
          </View>
        );

      case 'bullet':
        return (
          <View className="flex-row gap-2 pl-1">
            <View className="mt-2.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <LineInput
              {...lineProps(block, block)}
              className="flex-1 text-base leading-6 text-foreground"
            />
          </View>
        );

      case 'check':
        return (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: block.checked }}
              accessibilityLabel={block.text || '체크 항목'}
              hitSlop={8}
              onPress={() =>
                onChange(
                  replaceLine(body, block.line, (block.checked ? '- [ ] ' : '- [x] ') + block.text),
                )
              }
            >
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
            </Pressable>
            <LineInput
              {...lineProps(block, block)}
              className={`flex-1 text-base leading-6 ${
                block.checked ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            />
          </View>
        );

      case 'number':
        return (
          <View className="flex-row gap-2 pl-1">
            <Text className="text-base leading-6 text-muted-foreground">{block.order}.</Text>
            <LineInput
              {...lineProps(block, block)}
              className="flex-1 text-base leading-6 text-foreground"
            />
          </View>
        );

      case 'quote':
        return (
          <View className="border-l-2 border-border pl-3">
            <LineInput
              {...lineProps(block, block)}
              placeholder="값 없음"
              className="text-base italic leading-6 text-foreground"
            />
          </View>
        );

      case 'paragraph':
        return (
          <LineInput {...lineProps(block, block)} className="text-base leading-7 text-foreground" />
        );
    }
  }

  return (
    <View className="gap-2">
      {blocks.map((block, index) => (
        // 줄을 넣거나 빼도 입력칸이 자리를 지키도록 순서(index)를 key로 써요.
        <View key={index}>{renderBlock(block)}</View>
      ))}
    </View>
  );
}

interface LineInputProps {
  value: string;
  className: string;
  placeholder?: string;
  /** true가 되면 이 칸에 커서를 둬요. */
  focused: boolean;
  onFocused: () => void;
  onText: (text: string) => void;
  onEnter: (before: string, after: string) => void;
  onDeleteEmpty: () => void;
}

/** 꾸민 모양 그대로 고칠 수 있는 한 줄 입력칸. 길면 여러 줄로 넘어가요. */
function LineInput(props: LineInputProps) {
  const ref = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (props.focused) ref.current?.focus();
  }, [props.focused]);

  return (
    <TextInput
      ref={ref}
      value={props.value}
      multiline
      rows={1} // 웹 입력칸은 기본이 두 줄 높이라 한 줄로 시작해요
      scrollEnabled={false}
      placeholder={props.placeholder}
      placeholderTextColor={palette.mutedForeground}
      onFocus={props.onFocused}
      onChangeText={(text) => {
        // 엔터는 줄바꿈 글자로 들어와요. 한 줄은 본문의 한 줄이라 줄바꿈을 넣지 않고 엔터로 처리해요.
        const at = text.indexOf('\n');
        if (at === -1) props.onText(text);
        else props.onEnter(text.slice(0, at), text.slice(at + 1).replace(/\n/g, ' '));
      }}
      onKeyPress={(e) => {
        if (e.nativeEvent.key !== 'Backspace' || props.value !== '') return;
        // 웹에서는 커서가 윗줄로 옮겨진 뒤에 지우기가 한 번 더 먹지 않게 막아요.
        e.preventDefault();
        props.onDeleteEmpty();
      }}
      // 웹 입력칸은 내용만큼 저절로 늘어나지 않아서 field-sizing으로 늘려요. 앱에서는 원래 늘어나요.
      className={`p-0 web:[field-sizing:content] ${props.className}`}
    />
  );
}
