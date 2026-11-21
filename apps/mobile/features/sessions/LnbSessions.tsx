import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { listMySessions, type SessionItem } from './data';

// 왼쪽 메뉴 세션 섹션 내용. 내 세션 목록, 미완성 세션 묶음, 새 세션(＋) 줄이에요.
// 세션을 누르면 세션 화면과 똑같이 움직여요: 마지막 문서를 열고, 문서가 없으면 그 양식으로 새 문서를 열어요.
// 내 세션 화면(세션 목록, 양식 고르기)은 「새 세션」에서 들어가요.
// 미완성 세션(양식 없음)은 하나로 묶어 두고, 누르면 펼쳐요. 하나를 누르면 양식을 고를 수 있는 세션 화면으로 가요.
function editorHref(s: SessionItem) {
  if (s.lastDocumentId) return `/editor/${s.lastDocumentId}`;
  if (s.templateId === null) return '/sessions';
  return `/editor/new?templateId=${encodeURIComponent(s.templateId)}`;
}

export function LnbSessions({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  useEffect(() => {
    listMySessions()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const sessions = items.filter((s) => s.templateId !== null);
  const drafts = items.filter((s) => s.templateId === null);

  return (
    <>
      {sessions.map((s) => (
        <SessionRow key={s.id} title={s.title} onPress={() => onNavigate(editorHref(s))} />
      ))}

      {drafts.length > 0 ? (
        <>
          <Pressable
            onPress={() => setDraftsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: draftsOpen }}
            accessibilityLabel={`미완성 세션 ${drafts.length}개`}
            className="h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
          >
            <SymbolView
              name={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
              size={19}
              tintColor={palette.mutedForeground}
            />
            <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
              미완성 세션
            </Text>
            <Text className="text-[13px] text-muted-foreground">{drafts.length}</Text>
            <SymbolView
              name={
                draftsOpen
                  ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                  : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
              }
              size={17}
              tintColor={palette.mutedForeground}
            />
          </Pressable>
          {draftsOpen
            ? drafts.map((s) => (
                <SessionRow
                  key={s.id}
                  title={s.title}
                  indent
                  onPress={() => onNavigate(editorHref(s))}
                />
              ))
            : null}
        </>
      ) : null}

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

function SessionRow(props: { title: string; indent?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="link"
      className={`h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted ${
        props.indent ? 'pl-9' : ''
      }`}
    >
      {props.indent ? null : (
        <SymbolView
          name={{ ios: 'doc.text', android: 'description', web: 'description' }}
          size={19}
          tintColor={palette.mutedForeground}
        />
      )}
      <Text
        className={`flex-1 text-[15px] ${props.indent ? 'text-muted-foreground' : 'text-foreground'}`}
        numberOfLines={1}
      >
        {props.title}
      </Text>
    </Pressable>
  );
}
