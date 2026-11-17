import {
  assignTagToCategory,
  type DismissedTagSuggestion,
  type DismissedTagSuggestionRow,
  type TagCategory,
  type TagCategoryRow,
  type TagSuggestion,
  tagSuggestionKey,
  toDismissedTagSuggestion,
  toDismissedTagSuggestionInsert,
  toTagCategory,
  toTagCategoryInsert,
} from '@noteapp/shared';

import { localFirstTable } from './local-first';

// 해시태그 카테고리 저장소(테이블: tags_categories). 화면은 이 함수들만 쓰면 돼요.
// 메모·일정과 같은 방식이에요: 로그인 전엔 이 기기에만, 로그인 후엔 기기와 계정 둘 다(lib/local-first.ts).
// 계정 연결은 'calendar' 기능을 따라가요(EXPO_PUBLIC_SUPABASE_FEATURES에 calendar가 있으면 계정에도 저장).
// 묶는 규칙(해시태그 하나는 카테고리 하나에만)은 assignTag가 지켜요.
const table = localFirstTable<TagCategory>({
  feature: 'calendar',
  table: 'tags_categories',
  toRow: toTagCategoryInsert,
  fromRow: (row) => toTagCategory(row as TagCategoryRow),
});

const dismissedTable = localFirstTable<DismissedTagSuggestion>({
  feature: 'calendar',
  table: 'tags_dismissed_suggestions',
  toRow: toDismissedTagSuggestionInsert,
  fromRow: (row) => toDismissedTagSuggestion(row as DismissedTagSuggestionRow),
});

/** 내 카테고리 전부, 순서대로. */
export async function listTagCategories(): Promise<TagCategory[]> {
  return (await table.list()).sort((a, b) => a.order - b.order);
}

/** 새 카테고리를 만들어요. tags에 넣은 해시태그는 다른 카테고리에서 빠져요. */
export async function createTagCategory(input: {
  name: string;
  color?: string;
  tags?: string[];
}): Promise<TagCategory> {
  const now = new Date().toISOString();
  const all = await table.list();
  const tags = [...new Set(input.tags ?? [])];
  const category: TagCategory = {
    id: `tag-category-${Date.now()}`,
    name: input.name.trim(),
    tags,
    order: all.reduce((max, c) => Math.max(max, c.order + 1), 0),
    createdAt: now,
    updatedAt: now,
  };
  if (input.color) category.color = input.color;
  // 새 카테고리로 옮긴 해시태그는 원래 카테고리에서 빼요.
  const emptied = all
    .filter((c) => c.tags.some((t) => tags.includes(t)))
    .map((c) => ({ ...c, tags: c.tags.filter((t) => !tags.includes(t)), updatedAt: now }));
  await table.put([...emptied, category]);
  return category;
}

/** 이름·색·순서를 바꿔요. 해시태그를 넣고 뺄 때는 assignTag를 써요. */
export async function updateTagCategory(
  id: string,
  patch: Partial<Pick<TagCategory, 'name' | 'color' | 'order'>>,
): Promise<void> {
  const current = (await table.list()).find((c) => c.id === id);
  if (!current) return;
  await table.put([{ ...current, ...patch, updatedAt: new Date().toISOString() }]);
}

/** 해시태그를 카테고리에 넣어요. categoryId가 null이면 카테고리에서 빼요. */
export async function assignTag(tag: string, categoryId: string | null): Promise<void> {
  const changed = assignTagToCategory(await table.list(), tag, categoryId);
  if (changed.length > 0) await table.put(changed);
}

/** 카테고리를 지워요. 안에 있던 해시태그는 그대로 남고 묶음만 없어져요. */
export async function removeTagCategory(id: string): Promise<void> {
  await table.remove([id]);
}

// 자동 분류 추천: 앱이 계산해서 보여 주고, 확인하면 저장하고, 거절하면 기억해요.

/** 아직 거절하지 않은 추천만 남겨요. */
export async function withoutDismissed<S extends TagSuggestion>(suggestions: S[]): Promise<S[]> {
  const dismissed = new Set((await dismissedTable.list()).map((d) => d.id));
  return suggestions.filter((s) => !dismissed.has(tagSuggestionKey(s)));
}

/** 추천을 받아들여요. assign은 해시태그를 넣고, group은 새 카테고리를 만들어요. */
export async function acceptSuggestion(suggestion: TagSuggestion, name?: string): Promise<void> {
  if (suggestion.kind === 'assign') {
    await assignTag(suggestion.tag, suggestion.categoryId);
    return;
  }
  const fallback = suggestion.tags[0]?.replace(/^#/, '') ?? '새 카테고리';
  await createTagCategory({ name: name ?? suggestion.name ?? fallback, tags: suggestion.tags });
}

/** 추천을 거절해요. 같은 추천은 다시 나오지 않아요. */
export async function dismissSuggestion(suggestion: TagSuggestion): Promise<void> {
  await dismissedTable.put([
    { id: tagSuggestionKey(suggestion), createdAt: new Date().toISOString() },
  ]);
}
