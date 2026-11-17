import type { Template } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { templateIcon } from './icons';

interface Props {
  visible: boolean;
  templates: Template[];
  onPick: (template: Template) => void;
  onClose: () => void;
}

/** 아래에서 올라오는 양식 고르기 시트. 양식을 누르면 onPick으로 알려줘요. */
export function TemplatePickerModal({ visible, templates, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    // Modal: 화면 위에 겹쳐 뜨는 창이에요. animationType="slide"면 아래에서 올라와요.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-foreground/30" onPress={onClose} accessibilityLabel="닫기" />
      <View
        className="max-h-[80%] rounded-t-2xl bg-popover"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* 끌어내리는 손잡이 모양 (모양만 있어요) */}
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-full bg-border" />
        </View>
        <View className="flex-row items-center justify-between px-5 pb-2">
          <Text className="text-lg font-bold text-popover-foreground">어떤 문서를 쓸까요?</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text className="text-sm text-muted-foreground">닫기</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-2 px-5 pb-2">
          {templates.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.name} 양식으로 새 문서`}
              onPress={() => onPick(t)}
              className="flex-row gap-3 rounded-lg border border-border bg-card p-4 active:bg-muted"
            >
              <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
                <SymbolView name={templateIcon(t.icon)} size={22} tintColor={palette.primary} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-base font-bold text-card-foreground">{t.name}</Text>
                <Text className="text-[13px] leading-5 text-muted-foreground">{t.description}</Text>
                {t.tags?.length ? (
                  <View className="flex-row flex-wrap gap-1 pt-0.5">
                    {t.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('AI로 새 양식 만들기', '이 기능은 나중에(P1) 만들어요.')}
            className="mt-1 h-12 items-center justify-center rounded-lg border border-dashed border-primary active:bg-muted"
          >
            <Text className="text-sm font-semibold text-primary">AI로 새 양식 만들기</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** 작은 태그 배지 (목록 카드와 같이 써요) */
export function TagBadge({ tag }: { tag: string }) {
  return (
    <View className="rounded-full bg-muted px-2 py-0.5">
      <Text className="text-[11px] font-medium text-muted-foreground">{tag}</Text>
    </View>
  );
}
