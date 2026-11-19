import { fixtures } from '@noteapp/shared';
import { NoteRow, ScrollChips, Text } from '@noteapp/ui';
import { router } from 'expo-router';
import { FileTextIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'shared', label: '공유됨' },
];

// 피드 화면. 디자인 시스템 개편안(칩으로 거르기, 큰 사진 상자 없이 제목과 두 줄 미리보기)을 따라요.
export function FeedScreen() {
  const [filter, setFilter] = useState('all');
  const docs = filter === 'all' ? fixtures.documents : [];

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border py-3">
        <ScrollChips items={FILTERS} active={filter} onChange={setFilter} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-12 pt-2">
        {docs.length === 0 ? (
          <Text className="py-8 text-center text-sm text-muted-foreground">
            공유된 문서가 아직 없어요.
          </Text>
        ) : (
          docs.map((doc, index) => (
            <View key={doc.id}>
              {index > 0 ? <View className="h-px bg-border" /> : null}
              <Pressable onPress={() => router.push(`/editor/${doc.id}`)} accessibilityRole="link">
                <NoteRow
                  icon={FileTextIcon}
                  title={doc.title}
                  preview={doc.body.replace(/\s+/g, ' ').trim().slice(0, 80) || undefined}
                  when={doc.updatedAt.slice(5, 10)}
                />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
