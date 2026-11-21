import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, View } from 'react-native';

import {
  insertLineAfter,
  type LinePart,
  nextPrefix,
  parseBlocks,
  previousFilledLine,
  splitTags,
  type PreviewBlock,
  removeLine,
  replaceLine,
} from './blocks';
import { moveCursor } from './cursor';

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
  /** 커서를 옮겨 둘 줄 (새 줄을 만들거나 줄을 지운 뒤). 편집기가 들고 있어요. */
  focusLine: number | null;
  onFocusLine: (line: number | null) => void;
  /** 사용자가 마지막으로 누른 줄. 서식 막대가 그 아래에 새 줄을 넣어요. */
  onActiveLine: (line: number) => void;
}

/**
 * 본문을 꾸며서 보여주는 화면. 글자를 누르면 그 자리에서 바로 고칠 수 있어요.
 * 고친 글은 본문의 그 줄에만 반영돼요. 새 제목이나 항목은 아래 서식 막대로 넣어요.
 */
export function Preview({ body, onChange, focusLine, onFocusLine, onActiveLine }: Props) {
  const blocks = parseBlocks(body);
  const setFocusLine = onFocusLine;

  if (blocks.length === 0) {
    return (
      <Text className="text-sm text-muted-foreground">
        아직 쓴 내용이 없어요. 아래 서식 막대에서 제목이나 항목을 골라 넣어 보세요.
      </Text>
    );
  }

  /** 줄을 없애고, 글이 있는 윗줄 끝으로 커서를 옮겨요. */
  function removeAndGoUp(line: number) {
    const up = previousFilledLine(body, line);
    onChange(removeLine(body, line));
    setFocusLine(up >= 0 ? up : null);
  }

  /** 줄 하나를 고칠 때 쓰는 입력칸 속성을 만들어요. */
  function lineProps(part: LinePart, block: PreviewBlock) {
    return {
      value: part.text,
      focused: focusLine === part.line,
      onFocused: () => {
        setFocusLine(null);
        onActiveLine(part.line);
      },
      onText: (text: string) => {
        // 글만 있는 줄을 다 지우면 줄을 없애고 윗줄로 가요. 빈 줄은 화면에 안 보여서 입력칸이 사라지거든요.
        if (block.kind === 'paragraph' && text === '') return removeAndGoUp(part.line);
        onChange(replaceLine(body, part.line, part.prefix + text));
      },
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
      // 빈 줄에서 지우기(Backspace): 서식 줄이면 서식을 풀어 기호만 글로 남기고('### '는 '###'),
      // 글만 있는 줄이면 줄을 없애고 윗줄로 가요. 그래서 계속 누르면 기호도 한 글자씩 지워져요.
      onDeleteEmpty: () => {
        if (block.kind === 'paragraph') return removeAndGoUp(part.line);
        onChange(replaceLine(body, part.line, part.prefix.trimEnd()));
        setFocusLine(part.line);
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
                {/* 이름도 그 자리에서 고쳐요. 콜론과 줄바꿈은 이름과 값을 나누는 글자라 지워요.
                    이름을 다 지워도 표에 남도록 빈 이름은 띄어쓰기 하나로 적어요. */}
                <TextInput
                  value={row.label}
                  onChangeText={(label) => {
                    const name = label.replace(/[:\n]/g, '').slice(0, 20) || ' ';
                    onChange(replaceLine(body, row.line, `- ${name}: ${row.text}`));
                  }}
                  placeholder="이름"
                  placeholderTextColor={palette.mutedForeground}
                  onFocus={() => onActiveLine(row.line)}
                  accessibilityLabel="항목 이름"
                  className="w-24 p-0 text-sm leading-6 text-muted-foreground web:outline-none"
                />
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
  // 커서를 이미 옮겼는지. 글자를 칠 때마다 커서가 끝으로 튀지 않게, focused가 켜질 때 한 번만 옮겨요.
  const moved = useRef(false);
  const { focused, value } = props;
  // 해시태그가 있는 줄은 고치지 않을 때 태그를 칩 색으로 보여줘요. 누르면 입력칸으로 바뀌어요.
  const [editing, setEditing] = useState(false);
  const parts = splitTags(value);
  const showText = parts.some((p) => p.tag) && !editing && !focused;
  // 편집기가 커서를 옮겨 달라고 했거나(focused), 태그 줄을 눌러 입력칸으로 바뀐 때(editing)
  const wantFocus = focused || editing;

  useEffect(() => {
    if (!wantFocus) {
      moved.current = false;
      return;
    }
    if (moved.current) return;
    moved.current = true;
    ref.current?.focus();
    // 커서는 글 끝에 둬요. 서식을 푼 뒤 바로 이어서 지울 수 있게요.
    moveCursor(ref.current, value.length);
  }, [wantFocus, value.length]);

  if (showText) {
    return (
      <Text
        onPress={() => setEditing(true)}
        accessibilityHint="눌러서 고쳐요"
        className={props.className}
      >
        {parts.map((part, i) =>
          part.tag ? (
            <Text key={i} className="bg-primary-soft font-medium text-primary-soft-foreground">
              {part.text}
            </Text>
          ) : (
            part.text
          ),
        )}
      </Text>
    );
  }

  return (
    <TextInput
      ref={ref}
      onBlur={() => setEditing(false)}
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
      className={`p-0 web:outline-none web:[field-sizing:content] ${props.className}`}
    />
  );
}
