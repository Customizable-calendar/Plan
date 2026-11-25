import type { Session, Template, TemplateCategory } from '@noteapp/shared';
import { DaySectionTitle, Icon, palette, ScrollChips, Text, TreeRow } from '@noteapp/ui';
import { router, Stack, useFocusEffect } from 'expo-router';
import {
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from './ConfirmDialog';
import {
  type DocumentItem,
  deleteDocument,
  listDocuments,
  listDraftSessions,
  listTemplates,
  removeDraftSession,
} from './data';
import { shortDate } from './format';
import { GROUPS, groupOf } from './groups';
import { TemplatePickerModal } from './TemplatePickerModal';

const CATEGORIES: { key: string; value: TemplateCategory | undefined; label: string }[] = [
  { key: 'all', value: undefined, label: '전체' },
  { key: 'work', value: 'work', label: '업무일지' },
  { key: 'blog', value: 'blog', label: '블로그' },
  { key: 'meeting', value: 'meeting', label: '회의록' },
  { key: 'research', value: 'research', label: '연구논문' },
];

/** 세션 자료함: 검색 + 분류 칩 + 양식 폴더 트리(TreeRow) + 새 세션 버튼 */
export function SessionsListScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<TemplateCategory>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DocumentItem[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picking, setPicking] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Session[]>([]);
  const [completing, setCompleting] = useState<Session | null>(null);
  const [removingDraft, setRemovingDraft] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  useEffect(() => {
    listTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    listDraftSessions()
      .then(setDrafts)
      .catch(() => setDrafts([]));
  }, [reload]);

  useEffect(() => {
    let alive = true;
    listDocuments({ category, query })
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [category, query, reload]);

  // 양식별로 문서를 묶어 폴더 트리로 보여 줘요.
  // 블로그처럼 형식이 여러 개인 분류는 '블로그' 폴더 하나 아래에 형식별 폴더(블로그 글, 사진 포스트)로 넣어요.
  const groups = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, Folder>();
    for (const item of items) {
      const template = item.template;
      const id = template?.id ?? 'other';
      const name = template?.name ?? '기타 문서';
      const category = groupOf(template);
      if (category) {
        const parent = map.get(category) ?? {
          id: category,
          name: GROUPS[category]?.name ?? name,
          docs: [],
          subs: [],
        };
        let sub = parent.subs?.find((s) => s.id === id);
        if (!sub) {
          sub = { id, name, template, docs: [] };
          parent.subs?.push(sub);
        }
        sub.docs.push(item);
        map.set(category, parent);
        continue;
      }
      const group = map.get(id) ?? { id, name, template, docs: [] };
      group.docs.push(item);
      map.set(id, group);
    }
    return [...map.values()];
  }, [items]);

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteDocument(deleting.document.id);
    setDeleting(null);
    setReload((n) => n + 1);
  };

  const startNew = (t: Template) => {
    setPicking(false);
    router.push({ pathname: '/editor/[id]', params: { id: 'new', templateId: t.id } });
  };

  const completeDraft = async (t: Template) => {
    if (!completing) return;
    const seed = completing.source?.text ?? completing.title;
    setCompleting(null);
    await removeDraftSession(completing.id);
    router.push({ pathname: '/editor/[id]', params: { id: 'new', templateId: t.id, seed } });
  };

  const confirmRemoveDraft = async () => {
    if (!removingDraft) return;
    await removeDraftSession(removingDraft.id);
    setRemovingDraft(null);
    setReload((n) => n + 1);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: '세션' }} />

      <View className="gap-3 border-b border-border pb-3 pt-3">
        <View className="mx-5 h-11 flex-row items-center gap-2 rounded-lg bg-muted px-3">
          <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="제목, 내용, 태그로 찾기"
            placeholderTextColor={palette.mutedForeground}
            accessibilityLabel="세션 검색"
            returnKeyType="search"
            className="flex-1 text-base text-foreground"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="검색어 지우기" hitSlop={8}>
              <Icon as={XIcon} size={18} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>

        <ScrollChips
          items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
          active={category ?? 'all'}
          onChange={(k) => setCategory(CATEGORIES.find((c) => c.key === k)?.value)}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
      >
        {!category && !query && drafts.length ? (
          <View>
            <DaySectionTitle label="미완성 세션" count={drafts.length} />
            {drafts.map((d, index) => (
              <View key={d.id}>
                {index > 0 ? <View className="h-px bg-border" /> : null}
                <DraftRow
                  session={d}
                  onPick={() => setCompleting(d)}
                  onRemove={() => setRemovingDraft(d)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {items === null ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">불러오는 중</Text>
        ) : groups.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            {query || category ? '조건에 맞는 문서가 없어요.' : '아직 쓴 문서가 없어요.'}
          </Text>
        ) : (
          <View>
            <DaySectionTitle label="자료함" count={items.length} />
            {groups.map((group) => (
              <FolderTree
                key={group.id}
                folder={group}
                depth={0}
                collapsed={collapsed}
                onToggle={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
                onAdd={startNew}
                onOpen={(item) =>
                  router.push({ pathname: '/editor/[id]', params: { id: item.document.id } })
                }
                onLongPress={setDeleting}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => setPicking(true)}
        className="absolute right-5 h-14 flex-row items-center gap-2 rounded-full bg-primary px-5 shadow-lg active:opacity-80"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Icon as={PlusIcon} size={20} className="text-primary-foreground" />
        <Text className="text-base font-bold text-primary-foreground">새 세션</Text>
      </Pressable>

      <TemplatePickerModal
        visible={picking}
        templates={templates}
        onPick={startNew}
        onClose={() => setPicking(false)}
      />
      <TemplatePickerModal
        visible={completing !== null}
        templates={templates}
        onPick={completeDraft}
        onClose={() => setCompleting(null)}
      />

      <ConfirmDialog
        visible={deleting !== null}
        title="이 문서를 삭제할까요?"
        message={`'${deleting?.document.title ?? ''}' 문서가 목록에서 사라져요. 삭제한 문서는 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        visible={removingDraft !== null}
        title="미완성 세션을 지울까요?"
        message="이 세션을 만든 메모 원문도 함께 사라져요. 지운 세션은 되돌릴 수 없어요."
        confirmLabel="지우기"
        onConfirm={confirmRemoveDraft}
        onCancel={() => setRemovingDraft(null)}
      />
    </View>
  );
}

/** 자료함 폴더 하나. 형식 폴더(subs)가 있으면 그 아래에, 없으면 문서를 바로 보여줘요. */
interface Folder {
  id: string;
  name: string;
  template?: Template;
  docs: DocumentItem[];
  subs?: Folder[];
}

function folderCount(folder: Folder): number {
  return folder.docs.length + (folder.subs ?? []).reduce((n, s) => n + folderCount(s), 0);
}

function FolderTree(props: {
  folder: Folder;
  depth: number;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAdd: (template: Template) => void;
  onOpen: (item: DocumentItem) => void;
  onLongPress: (item: DocumentItem) => void;
}) {
  const { folder, depth } = props;
  const expanded = !props.collapsed[folder.id];
  const template = folder.template;
  return (
    <View>
      <TreeRow
        icon={expanded ? FolderOpenIcon : FolderIcon}
        label={folder.name}
        strong={depth === 0}
        depth={depth}
        count={folderCount(folder)}
        expanded={expanded}
        onPress={() => props.onToggle(folder.id)}
        onAdd={template ? () => props.onAdd(template) : undefined}
      />
      {expanded ? (
        <>
          {folder.subs?.map((sub) => (
            <FolderTree key={sub.id} {...props} folder={sub} depth={depth + 1} />
          ))}
          {folder.docs.map((item) => (
            <TreeRow
              key={item.document.id}
              icon={FileTextIcon}
              label={item.document.title}
              depth={depth + 1}
              meta={shortDate(item.document.updatedAt)}
              onPress={() => props.onOpen(item)}
              onLongPress={() => props.onLongPress(item)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function DraftRow({
  session,
  onPick,
  onRemove,
}: {
  session: Session;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="w-1 self-stretch rounded-full bg-primary" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
          {session.source?.text ?? session.title}
        </Text>
        <Text className="text-xs text-muted-foreground">
          막 쓰기에서, {shortDate(session.createdAt)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPick} className="h-9 justify-center px-2">
        <Text className="text-sm font-bold text-primary">양식 고르기</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="미완성 세션 지우기"
        onPress={onRemove}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center"
      >
        <Icon as={Trash2Icon} size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
