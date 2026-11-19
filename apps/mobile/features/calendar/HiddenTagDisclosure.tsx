import { Text } from '@noteapp/ui';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { normalizeHashtag } from './autoTags';
import { useItemTags } from './tagStore';

interface HiddenTagDisclosureProps {
  itemId: string;
  title: string;
  corpusFreq?: ReadonlyMap<string, number>;
  editable?: boolean;
  compact?: boolean;
  onPressTag?: (tag: string) => void;
}

/**
 * 평소에는 제목 옆 작은 토글 배지(`태그 N`)로 접혀 있다가,
 * 사용자가 눌렀을 때만 내부 해시태그 목록과 편집 컨트롤을 펼쳐 보여줘요.
 */
export function HiddenTagDisclosure({
  itemId,
  title,
  corpusFreq,
  editable = false,
  compact = false,
  onPressTag,
}: HiddenTagDisclosureProps) {
  const { tags, isManual, setTags, resetToAuto } = useItemTags(itemId, title, corpusFreq);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editable && tags.length === 0) {
    return null;
  }

  const handleAdd = async () => {
    const pieces = draft
      .split(/[,\s]+/)
      .map((part) => normalizeHashtag(part))
      .filter(Boolean);
    if (pieces.length === 0) return;

    const merged = [...tags];
    for (const piece of pieces) {
      if (!merged.includes(piece)) {
        merged.push(piece);
      }
    }
    setDraft('');
    await setTags(merged);
  };

  const handleRemove = async (target: string) => {
    await setTags(tags.filter((tag) => tag !== target));
  };

  const triggerLabel = open
    ? compact
      ? '태그 접기'
      : '태그 숨기기'
    : tags.length > 0
      ? `태그 ${tags.length}`
      : '태그 추가';

  return (
    <View className={compact ? 'mt-1.5' : 'mt-2'}>
      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          onPress={() => setOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={triggerLabel}
          className={
            open
              ? 'self-start rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1'
              : 'self-start rounded-full border border-border bg-muted px-2.5 py-1'
          }
        >
          <Text
            className={
              open
                ? 'text-[11px] font-semibold text-primary-soft-foreground'
                : 'text-[11px] font-semibold text-muted-foreground'
            }
          >
            {triggerLabel}
          </Text>
        </Pressable>
      </View>

      {open && (
        <View className="mt-2 gap-2 rounded-lg border border-border bg-muted/60 p-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[11px] font-semibold text-muted-foreground">
              {isManual ? '직접 관리 중인 태그' : '자동 추출된 태그'}
            </Text>
            {editable && isManual && (
              <Pressable onPress={() => void resetToAuto()}>
                <Text className="text-[11px] font-semibold text-primary">자동 추출로 되돌리기</Text>
              </Pressable>
            )}
          </View>

          {tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((tag) => (
                <View
                  key={tag}
                  className="flex-row items-center gap-1 rounded-full border border-primary/25 bg-primary-soft py-1 pl-2.5 pr-1.5"
                >
                  <Pressable
                    onPress={onPressTag ? () => onPressTag(tag) : undefined}
                    disabled={!onPressTag}
                  >
                    <Text className="text-[11px] font-semibold text-primary-soft-foreground">
                      {tag}
                    </Text>
                  </Pressable>
                  {editable && (
                    <Pressable
                      onPress={() => void handleRemove(tag)}
                      accessibilityLabel={`${tag} 삭제`}
                      className="rounded-full px-1 py-0.5"
                    >
                      <Text className="text-[11px] font-bold text-muted-foreground">x</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">연결된 태그가 없어요.</Text>
          )}

          {editable && (
            <View className="flex-row items-center gap-1.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void handleAdd()}
                placeholder="새 태그 입력"
                returnKeyType="done"
                className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
              />
              <Pressable
                onPress={() => void handleAdd()}
                className="rounded-md bg-primary px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-primary-foreground">추가</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
