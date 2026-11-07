import { palette } from '@noteapp/ui';
import { type Href, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lnbEntries } from '@/features/registry';
import type { FeatureLnbBlock, FeatureLnbItem, LnbSection } from '@/lib/feature';

import { useLnb } from './LnbContext';
import { Profile } from './Profile';

// 왼쪽 메뉴(LNB). 디자인 시스템 components/app/lnb.tsx의 drawer 모양을 따라요. (담당: D)
// 섹션 틀만 여기서 그리고, 줄은 각 기능 index.ts의 `lnb`에서 와요.

const SECTIONS: { key: LnbSection; title?: string }[] = [
  { key: 'quick', title: '빠른 실행' },
  { key: 'sessions', title: '세션' },
  { key: 'cards', title: '카드' },
  { key: 'more' },
];

function isBlock(entry: FeatureLnbItem | FeatureLnbBlock): entry is FeatureLnbBlock {
  return 'Component' in entry;
}

function Count({ use, emphasis }: { use: () => number | undefined; emphasis?: boolean }) {
  const n = use();
  if (n === undefined) return null;
  return emphasis ? (
    <View className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
      <Text className="text-[11px] font-bold text-primary-foreground">{n}</Text>
    </View>
  ) : (
    <Text className="text-xs text-muted-foreground">{n}</Text>
  );
}

function Item({ item, onNavigate }: { item: FeatureLnbItem; onNavigate: (href: string) => void }) {
  return (
    <Pressable
      onPress={() => onNavigate(item.href)}
      accessibilityRole="link"
      className="h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
    >
      <SymbolView name={item.icon} size={19} tintColor={palette.mutedForeground} />
      <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
        {item.label}
      </Text>
      {item.useCount ? <Count use={item.useCount} emphasis={item.emphasis} /> : null}
    </Pressable>
  );
}

export function Lnb() {
  const { open, hide } = useLnb();
  const insets = useSafeAreaInsets();

  const navigate = (href: string) => {
    hide();
    router.push(href as Href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={hide}>
      <View className="flex-1 flex-row">
        <View
          className="w-[300px] max-w-[85%] bg-background shadow-2xl"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <Profile onNavigate={navigate} />
          <ScrollView className="flex-1">
            {SECTIONS.map(({ key, title }) => {
              const entries = lnbEntries(key);
              if (!entries.length) return null;
              return (
                <View key={key} className="gap-0.5 border-t border-border px-3 py-2.5">
                  {title ? (
                    <Text className="px-2 pb-1 pt-0.5 text-xs font-semibold text-muted-foreground">
                      {title}
                    </Text>
                  ) : null}
                  {entries.map(({ id, entry }, i) =>
                    isBlock(entry) ? (
                      <entry.Component key={`${id}-${i}`} onNavigate={navigate} />
                    ) : (
                      <Item key={`${id}-${i}`} item={entry} onNavigate={navigate} />
                    ),
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
        {/* 메뉴 밖 어두운 곳을 누르면 닫혀요 */}
        <Pressable
          className="flex-1 bg-black/30"
          onPress={hide}
          accessibilityRole="button"
          accessibilityLabel="메뉴 닫기"
        />
      </View>
    </Modal>
  );
}
