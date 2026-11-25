import type { Template, TemplateCategory } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROUPS } from './groups';
import { formatIcon, templateIcon } from './icons';

interface Props {
  visible: boolean;
  templates: Template[];
  onPick: (template: Template) => void;
  onClose: () => void;
}

type Entry =
  | { kind: 'template'; template: Template }
  | { kind: 'group'; category: TemplateCategory; items: Template[] };

/** 양식 목록을 시트에 보여줄 칸으로 바꿔요. 묶을 분류는 처음 나온 자리에 한 칸만 둬요. */
function toEntries(templates: Template[]): Entry[] {
  const entries: Entry[] = [];
  for (const t of templates) {
    const category = t.category;
    const same = category ? templates.filter((x) => x.category === category) : [];
    if (category && GROUPS[category] && same.length > 1) {
      if (!entries.some((e) => e.kind === 'group' && e.category === category)) {
        entries.push({ kind: 'group', category, items: same });
      }
    } else {
      entries.push({ kind: 'template', template: t });
    }
  }
  return entries;
}

/** 아래에서 올라오는 양식 고르기 시트. 양식을 누르면 onPick으로 알려줘요. 블로그는 형식을 한 번 더 골라요. */
export function TemplatePickerModal({ visible, templates, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // 형식을 고르는 중인 분류. null이면 첫 목록이에요.
  const [open, setOpen] = useState<TemplateCategory | null>(null);
  const group = open ? GROUPS[open] : undefined;
  const items = open ? templates.filter((t) => t.category === open) : [];

  function close() {
    setOpen(null);
    onClose();
  }

  function pick(template: Template) {
    setOpen(null);
    onPick(template);
  }

  return (
    // Modal: 화면 위에 겹쳐 뜨는 창이에요. animationType="slide"면 아래에서 올라와요.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-foreground/30" onPress={close} accessibilityLabel="닫기" />
      <View
        className="max-h-[80%] rounded-t-2xl bg-popover"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* 끌어내리는 손잡이 모양 (모양만 있어요) */}
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-full bg-border" />
        </View>
        <View className="flex-row items-center gap-2 px-5 pb-2">
          {group ? (
            <Pressable
              onPress={() => setOpen(null)}
              accessibilityRole="button"
              accessibilityLabel="양식 목록으로"
              hitSlop={8}
            >
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={20}
                tintColor={palette.foreground}
              />
            </Pressable>
          ) : null}
          <Text className="flex-1 text-lg font-bold text-popover-foreground">
            {group ? group.ask : '어떤 문서를 쓸까요?'}
          </Text>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text className="text-sm text-muted-foreground">닫기</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-2 px-5 pb-2">
          {group ? (
            items.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                icon={formatIcon(t.id) ?? templateIcon(t.icon)}
                onPress={() => pick(t)}
              />
            ))
          ) : (
            <>
              {toEntries(templates).map((entry) =>
                entry.kind === 'template' ? (
                  <TemplateRow
                    key={entry.template.id}
                    template={entry.template}
                    icon={templateIcon(entry.template.icon)}
                    onPress={() => pick(entry.template)}
                  />
                ) : (
                  <GroupRow
                    key={entry.category}
                    name={GROUPS[entry.category]?.name ?? ''}
                    description={GROUPS[entry.category]?.description ?? ''}
                    formats={entry.items.map((t) => t.name)}
                    icon={templateIcon(entry.items[0]?.icon)}
                    onPress={() => setOpen(entry.category)}
                  />
                ),
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => Alert.alert('AI로 새 양식 만들기', '이 기능은 나중에(P1) 만들어요.')}
                className="mt-1 h-12 items-center justify-center rounded-lg border border-dashed border-primary active:bg-muted"
              >
                <Text className="text-sm font-semibold text-primary">AI로 새 양식 만들기</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

type IconName = ReturnType<typeof templateIcon>;

function TemplateRow(props: { template: Template; icon: IconName; onPress: () => void }) {
  const t = props.template;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.name} 양식으로 새 문서`}
      onPress={props.onPress}
      className="flex-row gap-3 rounded-lg border border-border bg-card p-4 active:bg-muted"
    >
      <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
        <SymbolView name={props.icon} size={22} tintColor={palette.primary} />
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
  );
}

/** 형식이 여러 개인 분류 한 칸. 누르면 형식 고르기로 넘어가요. */
function GroupRow(props: {
  name: string;
  description: string;
  formats: string[];
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.name}, 형식 고르기`}
      onPress={props.onPress}
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4 active:bg-muted"
    >
      <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
        <SymbolView name={props.icon} size={22} tintColor={palette.primary} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base font-bold text-card-foreground">{props.name}</Text>
        <Text className="text-[13px] leading-5 text-muted-foreground">{props.description}</Text>
        <View className="flex-row flex-wrap gap-1 pt-0.5">
          {props.formats.map((f) => (
            <TagBadge key={f} tag={f} />
          ))}
        </View>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={18}
        tintColor={palette.mutedForeground}
      />
    </Pressable>
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
