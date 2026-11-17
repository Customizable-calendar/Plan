import type { Session, Template, TemplateCategory } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { templateIcon } from './icons';
import { TagBadge, TemplatePickerModal } from './TemplatePickerModal';

const CATEGORIES: { value: TemplateCategory | undefined; label: string }[] = [
  { value: undefined, label: '전체' },
  { value: 'work', label: '업무일지' },
  { value: 'blog', label: '블로그' },
  { value: 'meeting', label: '회의록' },
  { value: 'research', label: '연구논문' },
];

/** 세션 목록: 칩 필터 + 검색 + 작성한 문서 카드 + 새 세션 작성 버튼 */
export function SessionsListScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<TemplateCategory>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DocumentItem[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picking, setPicking] = useState(false);
  // 미완성 세션 목록과, 양식을 고르는 중인 미완성 세션
  const [drafts, setDrafts] = useState<Session[]>([]);
  const [completing, setCompleting] = useState<Session | null>(null);
  const [removingDraft, setRemovingDraft] = useState<Session | null>(null);
  // 삭제 확인창에 띄울 문서. null이면 확인창이 닫혀 있어요.
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  // 편집기에서 돌아올 때마다 1씩 올려서 목록을 다시 불러와요.
  const [reload, setReload] = useState(0);

  // useFocusEffect: 이 화면이 다시 보일 때(편집기에서 뒤로 왔을 때) 실행돼요.
  useFocusEffect(useCallback(() => setReload((n) => n + 1), []));

  useEffect(() => {
    listTemplates().then(setTemplates);
  }, []);

  // 막 쓰기에서 넘긴 미완성 세션. 화면에 돌아올 때마다 다시 불러와요.
  useEffect(() => {
    listDraftSessions()
      .then(setDrafts)
      .catch(() => setDrafts([]));
  }, [reload]);

  useEffect(() => {
    let alive = true; // 필터를 빨리 바꿨을 때 늦게 온 옛 결과는 버려요
    listDocuments({ category, query })
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [category, query, reload]);

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteDocument(deleting.document.id);
    setDeleting(null);
    setReload((n) => n + 1); // 목록을 다시 불러와요
  };

  const startNew = (t: Template) => {
    setPicking(false);
    router.push({ pathname: '/editor/[id]', params: { id: 'new', templateId: t.id } });
  };

  // 미완성 세션에 양식을 고르면: 메모 원문을 맨 위에 넣은 새 문서를 열고, 미완성 목록에서 빼요.
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

      <View className="gap-3 border-b border-border px-4 pb-3 pt-3">
        <View className="h-11 flex-row items-center gap-2 rounded-md bg-muted px-3">
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={palette.mutedForeground}
          />
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
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                size={18}
                tintColor={palette.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {CATEGORIES.map((c) => {
            const on = category === c.value;
            return (
              <Pressable
                key={c.label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCategory(c.value)}
                className={`h-8 justify-center rounded-full border px-3.5 ${
                  on ? 'border-primary bg-primary' : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-[13px] font-semibold ${
                    on ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }} // FAB에 가리지 않게
        keyboardShouldPersistTaps="handled"
      >
        {/* 미완성 세션: 분류나 검색으로 거르지 않을 때만 맨 위에 보여요. */}
        {!category && !query && drafts.length ? (
          <View className="gap-2">
            <Text className="text-[13px] font-semibold text-muted-foreground">미완성 세션</Text>
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                session={d}
                onPick={() => setCompleting(d)}
                onRemove={() => setRemovingDraft(d)}
              />
            ))}
            <Text className="pt-2 text-[13px] font-semibold text-muted-foreground">
              작성한 문서
            </Text>
          </View>
        ) : null}

        {items === null ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">불러오는 중</Text>
        ) : items.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            {query || category ? '조건에 맞는 문서가 없어요.' : '아직 쓴 문서가 없어요.'}
          </Text>
        ) : (
          items.map((item) => (
            <DocumentCard key={item.document.id} item={item} onDelete={() => setDeleting(item)} />
          ))
        )}
      </ScrollView>

      {/* FAB(떠 있는 버튼): 목록을 스크롤해도 오른쪽 아래에 그대로 있어요. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setPicking(true)}
        className="absolute right-4 h-14 flex-row items-center gap-2 rounded-full bg-primary px-5 shadow-lg active:opacity-80"
        style={{ bottom: insets.bottom + 16 }}
      >
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          size={20}
          tintColor={palette.primaryForeground}
        />
        <Text className="text-base font-bold text-primary-foreground">새 세션 작성</Text>
      </Pressable>

      <TemplatePickerModal
        visible={picking}
        templates={templates}
        onPick={startNew}
        onClose={() => setPicking(false)}
      />
      {/* 미완성 세션의 양식 고르기. 같은 시트를 써요. */}
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

/** 미완성 세션 한 장: 양식을 아직 안 골랐다는 표시 + 메모 원문 + 양식 고르기 */
function DraftCard({
  session,
  onPick,
  onRemove,
}: {
  session: Session;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="gap-2 rounded-lg border border-dashed border-primary bg-card p-4">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary-soft px-2 py-0.5">
          <Text className="text-[11px] font-bold text-primary-soft-foreground">미완성</Text>
        </View>
        <Text className="flex-1 text-xs text-muted-foreground">
          막 쓰기에서 {shortDate(session.createdAt)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="미완성 세션 지우기"
          onPress={onRemove}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-md active:bg-muted"
        >
          <SymbolView
            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
            size={16}
            tintColor={palette.mutedForeground}
          />
        </Pressable>
      </View>
      <Text className="text-[15px] leading-6 text-card-foreground" numberOfLines={4}>
        {session.source?.text ?? session.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPick}
        className="h-9 justify-center self-end rounded-md bg-primary px-4 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-primary-foreground">양식 고르기</Text>
      </Pressable>
    </View>
  );
}

function DocumentCard({
  item: { document, template },
  onDelete,
}: {
  item: DocumentItem;
  onDelete: () => void;
}) {
  return (
    // 삭제 버튼을 카드 버튼 "안"에 넣으면 웹에서 <button> 안에 <button>이 되어 오류가 나요.
    // 그래서 카드와 삭제 버튼을 나란히 두고, 삭제 버튼을 오른쪽 위에 겹쳐 올려요(absolute).
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${document.title} 열기`}
        // 편집기에는 id만 넘기고, 편집기가 자기 data.ts로 내용을 불러와요.
        onPress={() => router.push({ pathname: '/editor/[id]', params: { id: document.id } })}
        className="flex-row gap-3 rounded-lg border border-border bg-card p-4 active:bg-muted"
      >
        <View className="h-10 w-10 items-center justify-center rounded-md bg-primary-soft">
          <SymbolView name={templateIcon(template?.icon)} size={20} tintColor={palette.primary} />
        </View>
        <View className="flex-1 gap-1.5">
          {/* pr-8: 오른쪽 위 삭제 버튼 자리를 비워 둬요. */}
          <View className="flex-row items-baseline gap-2 pr-8">
            <Text className="flex-1 text-base font-bold text-card-foreground" numberOfLines={1}>
              {document.title}
            </Text>
            <Text className="text-xs text-muted-foreground">{shortDate(document.updatedAt)}</Text>
          </View>
          <Text className="text-[13px] leading-5 text-muted-foreground" numberOfLines={2}>
            {preview(document.body) || '아직 내용이 없어요.'}
          </Text>
          {template?.tags?.length ? (
            <View className="flex-row flex-wrap gap-1">
              {template.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${document.title} 삭제`}
        onPress={onDelete}
        hitSlop={8}
        className="absolute right-2.5 top-3 h-8 w-8 items-center justify-center rounded-md active:bg-muted"
      >
        <SymbolView
          name={{ ios: 'trash', android: 'delete', web: 'delete' }}
          size={16}
          tintColor={palette.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

/** 본문 미리보기: 제목 줄(#)과 빈 항목은 빼고, 마크다운 머리를 떼서 한 줄로 이어요. */
function preview(body: string): string {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^(- \[[ x]\] |- |> |\d+\. )/, '').trim())
    .filter(Boolean)
    .join('  ');
}
