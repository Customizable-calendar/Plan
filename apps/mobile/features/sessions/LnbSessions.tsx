import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { listMySessions, type SessionItem } from './data';

// 왼쪽 메뉴 세션 섹션 내용. 내 세션 목록과 새 세션(＋) 줄이에요.
// 세션을 누르면 세션 화면과 똑같이 움직여요: 마지막 문서를 열고, 문서가 없으면 그 양식으로 새 문서를 열어요.
// 내 세션 화면(세션 목록, 양식 고르기)은 「새 세션」에서 들어가요.
function editorHref(s: SessionItem) {
  return s.lastDocumentId
    ? `/editor/${s.lastDocumentId}`
    : `/editor/new?templateId=${encodeURIComponent(s.templateId)}`;
}
export function LnbSessions({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [items, setItems] = useState<SessionItem[]>([]);
  useEffect(() => {
    listMySessions()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <>
      {items.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onNavigate(editorHref(s))}
          accessibilityRole="link"
          className="h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
        >
          <SymbolView
            name={{ ios: 'doc.text', android: 'description', web: 'description' }}
            size={19}
            tintColor={palette.mutedForeground}
          />
          <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
            {s.title}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => onNavigate('/sessions')}
        accessibilityRole="link"
        className="h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
      >
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          size={19}
          tintColor={palette.primary}
        />
        <Text className="flex-1 text-[15px] text-primary">새 세션</Text>
      </Pressable>
    </>
  );
}
