import type { Document } from '@noteapp/shared';
import { CountTabs, NoteRow, Text } from '@noteapp/ui';
import { router } from 'expo-router';
import { FileTextIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { listRecentDocuments } from './data';
import { shortDate } from './format';

// 홈 최근 문서 자리(recent). 디자인 시스템 CountTabs와 NoteRow를 써요. 누르면 편집기로 열어요.
export function RecentDocs() {
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [tab, setTab] = useState('recent');

  useEffect(() => {
    listRecentDocuments()
      .then(setDocs)
      .catch(() => setDocs([]));
  }, []);

  const shown = tab === 'recent' ? (docs ?? []) : [];

  return (
    <View className="-mx-5">
      <CountTabs
        items={[
          { key: 'recent', label: '최근 문서', count: docs ? docs.length : undefined },
          { key: 'shared', label: '공유됨' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <View className="px-5">
        {docs === null ? (
          <Text className="py-4 text-sm text-muted-foreground">불러오는 중</Text>
        ) : shown.length === 0 ? (
          <Text className="py-4 text-sm text-muted-foreground">
            {tab === 'recent' ? '아직 만든 문서가 없어요.' : '공유된 문서가 없어요.'}
          </Text>
        ) : (
          shown.map((d, index) => (
            <View key={d.id}>
              {index > 0 ? <View className="h-px bg-border" /> : null}
              <Pressable onPress={() => router.push(`/editor/${d.id}`)} accessibilityRole="link">
                <NoteRow
                  icon={FileTextIcon}
                  title={d.title}
                  preview={d.body.replace(/\s+/g, ' ').trim().slice(0, 60) || undefined}
                  when={shortDate(d.updatedAt)}
                />
              </Pressable>
            </View>
          ))
        )}
        <View className="h-px bg-border" />
        <Pressable
          onPress={() => router.push(tab === 'recent' ? '/sessions' : '/feed')}
          accessibilityRole="link"
          className="h-12 justify-center"
        >
          <Text className="text-[15px] font-bold text-primary">
            {tab === 'recent' ? '전체 문서' : '공유됨 전체'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
