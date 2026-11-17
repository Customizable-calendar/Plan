// 해시태그 자동 분류 추천을 다듬는 순수 함수. AI(B)나 규칙(C)이 낸 추천을 화면에 보여 주기 전에 거쳐요.
import type { TagCategory, TagSuggestion } from './types';

const TAG = /^#[^\s#]+$/;

/**
 * 추천을 믿을 수 있는 것만 남겨요.
 * - 쓰고 있는 해시태그(knownTags)만, 아직 카테고리가 없는 해시태그만
 * - assign은 있는 카테고리로만
 * - 해시태그 하나는 추천 하나에만(먼저 나온 것)
 * - group은 해시태그 2개 이상, 이름은 다듬어서 30자까지
 */
export function cleanTagSuggestions(
  suggestions: readonly TagSuggestion[],
  categories: readonly TagCategory[],
  knownTags: Iterable<string>,
): TagSuggestion[] {
  const known = new Set(knownTags);
  const categoryIds = new Set(categories.map((c) => c.id));
  const used = new Set(categories.flatMap((c) => c.tags));
  const free = (tag: string) => TAG.test(tag) && known.has(tag) && !used.has(tag);
  const out: TagSuggestion[] = [];
  for (const s of suggestions) {
    if (s.kind === 'assign') {
      if (!free(s.tag) || !categoryIds.has(s.categoryId)) continue;
      used.add(s.tag);
      out.push({ kind: 'assign', tag: s.tag, categoryId: s.categoryId });
      continue;
    }
    const tags = [...new Set(s.tags)].filter(free);
    if (tags.length < 2) continue;
    tags.forEach((t) => used.add(t));
    const name = s.name?.trim().slice(0, 30);
    out.push(name ? { kind: 'group', tags, name } : { kind: 'group', tags });
  }
  return out;
}
