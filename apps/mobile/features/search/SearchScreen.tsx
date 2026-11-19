import { CountTabs, Icon, NoteRow, palette, Text } from '@noteapp/ui';
import { FileTextIcon, SearchIcon, XIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useItems } from './data';

// 검색 화면. 디자인 시스템 개편안(한 줄 검색창, 개수 붙는 탭, 상자 없는 결과 목록)을 따라요.
export function SearchScreen() {
  const { items, loading } = useItems();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');

  const trimmed = query.trim().toLowerCase();
  const matched = useMemo(
    () => (trimmed ? items.filter((it) => it.title.toLowerCase().includes(trimmed)) : items),
    [items, trimmed],
  );

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 pb-3 pt-4">
        <View className="h-11 flex-row items-center gap-2 rounded-lg bg-muted px-3">
          <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="메모, 카드, 문서 찾기"
            placeholderTextColor={palette.mutedForeground}
            accessibilityLabel="전체 검색"
            returnKeyType="search"
            className="flex-1 text-base text-foreground"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="검색어 지우기" hitSlop={8}>
              <Icon as={XIcon} size={18} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <CountTabs
        items={[{ key: 'all', label: '전체', count: matched.length }]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-12 pt-2">
        {loading ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">불러오는 중</Text>
        ) : matched.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            찾는 내용이 없어요.
          </Text>
        ) : (
          matched.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View className="h-px bg-border" /> : null}
              <NoteRow icon={FileTextIcon} title={item.title} when="예시" />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
