import type { Document } from '@noteapp/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { listRecentDocuments } from './data';
import { shortDate } from './format';

// 홈 최근 문서 자리(recent). 누르면 편집기로 열어요.
export function RecentDocs() {
  const [docs, setDocs] = useState<Document[] | null>(null);
  useEffect(() => {
    listRecentDocuments()
      .then(setDocs)
      .catch(() => setDocs([]));
  }, []);

  return (
    <View>
      <Text className="pb-1 text-[13px] font-semibold text-muted-foreground">최근 문서</Text>
      {docs === null ? (
        <Text className="py-3 text-sm text-muted-foreground">불러오는 중</Text>
      ) : docs.length === 0 ? (
        <Text className="py-3 text-sm text-muted-foreground">아직 만든 문서가 없어요.</Text>
      ) : (
        docs.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => router.push(`/editor/${d.id}`)}
            accessibilityRole="link"
            className="flex-row items-center border-b border-border py-3.5"
          >
            <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
              {d.title}
            </Text>
            <Text className="text-xs text-muted-foreground">{shortDate(d.updatedAt)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
