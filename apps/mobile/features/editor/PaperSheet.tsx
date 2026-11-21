import { Button, palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keywordTag, type PaperExtract, type PaperPart } from './paper';

interface Props {
  /** null이면 닫혀 있어요. 'loading'이면 PDF를 읽는 중이에요. */
  state: PaperExtract | 'loading' | null;
  error?: string | null;
  onApply: (parts: PaperPart[]) => void;
  onClose: () => void;
}

/**
 * PDF에서 찾은 논문 정보, 초록, 키워드, 서론을 "제안"으로 보여주는 시트.
 * 사용자가 고른 것만 본문에 넣어요. 못 찾은 것은 못 찾았다고 보여주고 지어내지 않아요.
 */
export function PaperSheet({ state, error, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const found = state && state !== 'loading' ? state : null;
  // 사용자가 바꾼 고르기. 다른 PDF 결과(found)가 오면 처음 고르기(찾은 것 전부)로 돌아가요.
  const [choice, setChoice] = useState<{ of: PaperExtract | null; parts: PaperPart[] }>({
    of: null,
    parts: [],
  });
  const picked = found && choice.of === found ? choice.parts : defaultParts(found);

  const toggle = (part: PaperPart) =>
    setChoice({
      of: found,
      parts: picked.includes(part) ? picked.filter((p) => p !== part) : [...picked, part],
    });

  const info = found
    ? [
        ['제목', found.title],
        ['저자', found.authors],
        ['연도', found.year],
        ['DOI', found.doi],
      ].filter((row): row is [string, string] => Boolean(row[1]))
    : [];

  return (
    <Modal visible={state !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-foreground/30" onPress={onClose} accessibilityLabel="닫기" />
      <View
        className="max-h-[85%] rounded-t-2xl bg-popover"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-full bg-border" />
        </View>
        <View className="flex-row items-center justify-between px-5 pb-1">
          <Text className="text-lg font-bold text-popover-foreground">PDF에서 찾은 내용</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text className="text-sm text-muted-foreground">닫기</Text>
          </Pressable>
        </View>
        <Text className="px-5 pb-3 text-sm text-muted-foreground">
          고른 것만 본문에 넣어요. 비어 있는 논문 정보 칸만 채우고, 이미 적은 값은 그대로 둬요.
        </Text>

        {state === 'loading' ? (
          <View className="items-center gap-2 py-10">
            <ActivityIndicator color={palette.mutedForeground} />
            <Text className="text-sm text-muted-foreground">PDF를 읽는 중이에요</Text>
          </View>
        ) : found ? (
          <>
            {error ? <Text className="px-5 pb-3 text-sm text-destructive">{error}</Text> : null}
            <ScrollView contentContainerClassName="gap-2 px-5 pb-3">
              <Item
                title="논문 정보"
                on={picked.includes('info')}
                missing={info.length === 0}
                onToggle={() => toggle('info')}
              >
                {info.map(([label, value]) => (
                  <Text key={label} className="text-sm text-foreground" numberOfLines={2}>
                    <Text className="text-muted-foreground">{label} </Text>
                    {value}
                  </Text>
                ))}
              </Item>
              <Item
                title="초록"
                source={found.abstract && `${found.abstract.page}쪽`}
                on={picked.includes('abstract')}
                missing={!found.abstract}
                onToggle={() => toggle('abstract')}
              >
                <Text className="text-sm leading-5 text-foreground" numberOfLines={5}>
                  {found.abstract?.text}
                </Text>
              </Item>
              <Item
                title="키워드"
                on={picked.includes('keywords')}
                missing={!found.keywords?.length}
                onToggle={() => toggle('keywords')}
              >
                <Text className="text-sm text-primary">
                  {found.keywords?.map(keywordTag).join(' ')}
                </Text>
              </Item>
              <Item
                title="서론"
                source={found.introduction && `${found.introduction.page}쪽부터`}
                on={picked.includes('introduction')}
                missing={!found.introduction}
                onToggle={() => toggle('introduction')}
              >
                <Text className="text-sm leading-5 text-foreground" numberOfLines={5}>
                  {found.introduction?.text}
                </Text>
              </Item>
            </ScrollView>
            <View className="px-5 pt-2">
              <Button disabled={picked.length === 0} onPress={() => onApply(picked)}>
                <Text className="font-medium text-primary-foreground">
                  {picked.length ? `${picked.length}개 본문에 넣기` : '넣을 것을 골라 주세요'}
                </Text>
              </Button>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

/** 처음 고르기: 찾은 항목 전부 */
function defaultParts(found: PaperExtract | null): PaperPart[] {
  if (!found) return [];
  const parts: PaperPart[] = [];
  if (found.title || found.authors || found.year || found.doi) parts.push('info');
  if (found.abstract) parts.push('abstract');
  if (found.keywords?.length) parts.push('keywords');
  if (found.introduction) parts.push('introduction');
  return parts;
}

function Item(props: {
  title: string;
  source?: string;
  on: boolean;
  missing: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (props.missing) {
    return (
      <View className="flex-row items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
        <Text className="flex-1 text-sm font-semibold text-muted-foreground">{props.title}</Text>
        <Text className="text-xs text-muted-foreground">찾지 못했어요</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.on }}
      className={`gap-1.5 rounded-lg border px-3 py-2.5 ${
        props.on ? 'border-primary bg-primary-soft' : 'border-border'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <SymbolView
          name={
            props.on
              ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' }
              : {
                  ios: 'square',
                  android: 'check_box_outline_blank',
                  web: 'check_box_outline_blank',
                }
          }
          size={20}
          tintColor={props.on ? palette.primary : palette.mutedForeground}
        />
        <Text className="flex-1 text-sm font-semibold text-foreground">{props.title}</Text>
        {props.source ? (
          <Text className="text-xs text-muted-foreground">PDF {props.source}</Text>
        ) : null}
      </View>
      {props.children}
    </Pressable>
  );
}
