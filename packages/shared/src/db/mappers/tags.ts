// tags_categories 행(snake_case) ↔ 앱 TagCategory(camelCase). (담당: B)
import type { DismissedTagSuggestion, TagCategory, TagSuggestion } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type TagCategoryRow = Tables<'tags_categories'>;
export type TagCategoryInsert = TablesInsert<'tags_categories'>;
export type DismissedTagSuggestionRow = Tables<'tags_dismissed_suggestions'>;
export type DismissedTagSuggestionInsert = TablesInsert<'tags_dismissed_suggestions'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toTagCategory(row: TagCategoryRow): TagCategory {
  const category: TagCategory = {
    id: row.id,
    name: row.name,
    tags: row.tags,
    order: row.sort_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.color !== null) category.color = row.color;
  return category;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toTagCategoryInsert(category: TagCategory): TagCategoryInsert {
  return {
    id: category.id,
    name: category.name,
    color: category.color ?? null,
    tags: category.tags,
    sort_order: category.order,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
  };
}

/**
 * 해시태그를 카테고리에 넣어요(categoryId가 null이면 어느 카테고리에서도 빼요).
 * 해시태그 하나는 카테고리 하나에만 있게, 다른 카테고리에 있던 건 빼요.
 * 바뀐 카테고리만 돌려줘요. 그대로 저장(put)하면 돼요.
 */
export function assignTagToCategory(
  categories: readonly TagCategory[],
  tag: string,
  categoryId: string | null,
  now: string = new Date().toISOString(),
): TagCategory[] {
  const changed: TagCategory[] = [];
  for (const category of categories) {
    const has = category.tags.includes(tag);
    const want = category.id === categoryId;
    if (has === want) continue;
    changed.push({
      ...category,
      tags: want ? [...category.tags, tag] : category.tags.filter((t) => t !== tag),
      updatedAt: now,
    });
  }
  return changed;
}

/** 해시태그 → 카테고리 id. 화면에서 색을 칠하거나 묶을 때 써요. */
export function tagCategoryIndex(categories: readonly TagCategory[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const category of [...categories].sort((a, b) => a.order - b.order)) {
    for (const tag of category.tags) if (!index.has(tag)) index.set(tag, category.id);
  }
  return index;
}

/** 추천 하나를 가리키는 키. 거절 기록(tags_dismissed_suggestions.id)에 써요. */
export function tagSuggestionKey(suggestion: TagSuggestion): string {
  return suggestion.kind === 'assign'
    ? `assign:${suggestion.tag}:${suggestion.categoryId}`
    : `group:${[...new Set(suggestion.tags)].sort().join(',')}`;
}

export function toDismissedTagSuggestion(row: DismissedTagSuggestionRow): DismissedTagSuggestion {
  return { id: row.id, createdAt: iso(row.created_at) };
}

export function toDismissedTagSuggestionInsert(
  dismissed: DismissedTagSuggestion,
): DismissedTagSuggestionInsert {
  return { id: dismissed.id, created_at: dismissed.createdAt };
}
