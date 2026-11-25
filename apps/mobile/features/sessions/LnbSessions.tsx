import { type TemplateCategory, templates } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { listMySessions, type SessionItem } from './data';
import { GROUPS, groupOf } from './groups';

// 왼쪽 메뉴 세션 섹션 내용. 내 세션 목록, 미완성 세션 묶음, 새 세션(＋) 줄이에요.
// 세션을 누르면 세션 화면과 똑같이 움직여요: 마지막 문서를 열고, 문서가 없으면 그 양식으로 새 문서를 열어요.
// 내 세션 화면(세션 목록, 양식 고르기)은 「새 세션」에서 들어가요.
// 블로그처럼 형식이 여러 개인 양식(블로그 글, 사진 포스트)은 '블로그' 한 줄로 묶고, 누르면 펼쳐요.
// 미완성 세션(양식 없음)도 하나로 묶어 두고, 하나를 누르면 양식을 고를 수 있는 세션 화면으로 가요.
function editorHref(s: SessionItem) {
  if (s.lastDocumentId) return `/editor/${s.lastDocumentId}`;
  if (s.templateId === null) return '/sessions';
  return `/editor/new?templateId=${encodeURIComponent(s.templateId)}`;
}

/** 메뉴에 보여줄 줄: 세션 하나, 또는 묶음(블로그) 하나 */
type Entry =
  | { kind: 'session'; session: SessionItem }
  | { kind: 'group'; category: TemplateCategory; sessions: SessionItem[] };

function toEntries(sessions: SessionItem[]): Entry[] {
  const entries: Entry[] = [];
  for (const s of sessions) {
    const category = groupOf(templates.find((t) => t.id === s.templateId));
    if (!category) {
      entries.push({ kind: 'session', session: s });
      continue;
    }
    // 묶음은 처음 나온 자리에 한 줄만 둬요.
    const group = entries.find((e) => e.kind === 'group' && e.category === category);
    if (group?.kind === 'group') group.sessions.push(s);
    else entries.push({ kind: 'group', category, sessions: [s] });
  }
  return entries;
}

export function LnbSessions({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [items, setItems] = useState<SessionItem[]>([]);
  // 펼친 묶음. 'drafts'는 미완성 세션, 나머지는 분류(blog 등)
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    listMySessions()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const sessions = items.filter((s) => s.templateId !== null);
  const drafts = items.filter((s) => s.templateId === null);
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <>
      {toEntries(sessions).map((entry) =>
        entry.kind === 'session' ? (
          <SessionRow
            key={entry.session.id}
            title={entry.session.title}
            onPress={() => onNavigate(editorHref(entry.session))}
          />
        ) : (
          <GroupRows
            key={entry.category}
            label={GROUPS[entry.category]?.name ?? entry.category}
            icon={{ ios: 'folder', android: 'folder', web: 'folder' }}
            sessions={entry.sessions}
            open={!!open[entry.category]}
            onToggle={() => toggle(entry.category)}
            onPick={(s) => onNavigate(editorHref(s))}
            // 블로그 묶음 안에서는 형식 이름(블로그 글, 사진 포스트)으로 보여줘요.
            childTitle={(s) => s.templateName}
          />
        ),
      )}

      {drafts.length > 0 ? (
        <GroupRows
          label="미완성 세션"
          icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
          sessions={drafts}
          open={!!open.drafts}
          onToggle={() => toggle('drafts')}
          onPick={(s) => onNavigate(editorHref(s))}
        />
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

/** 묶음 한 줄(이름, 개수, 펼침 표시)과, 펼치면 그 아래 세션들 */
function GroupRows(props: {
  label: string;
  icon: SymbolViewProps['name'];
  sessions: SessionItem[];
  open: boolean;
  onToggle: () => void;
  onPick: (session: SessionItem) => void;
  /** 펼친 줄에 보여줄 이름. 없으면 세션 제목 */
  childTitle?: (session: SessionItem) => string;
}) {
  return (
    <>
      <Pressable
        onPress={props.onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: props.open }}
        accessibilityLabel={`${props.label} ${props.sessions.length}개`}
        className="h-11 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
      >
        <SymbolView name={props.icon} size={19} tintColor={palette.mutedForeground} />
        <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
          {props.label}
        </Text>
        <Text className="text-[13px] text-muted-foreground">{props.sessions.length}</Text>
        <SymbolView
          name={
            props.open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={17}
          tintColor={palette.mutedForeground}
        />
      </Pressable>
      {props.open
        ? props.sessions.map((s) => (
            <SessionRow
              key={s.id}
              title={props.childTitle?.(s) ?? s.title}
              indent
              onPress={() => props.onPick(s)}
            />
          ))
        : null}
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
