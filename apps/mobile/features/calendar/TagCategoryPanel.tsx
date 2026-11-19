import { type TagCategory, type TagSuggestion, tagSuggestionKey } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  acceptSuggestion,
  dismissSuggestion,
  listTagCategories,
  removeTagCategory,
} from '@/lib/tag-categories';
import { canSuggestTagsWithAi, suggestTagCategoriesWithAi } from '@/lib/tag-suggest-ai';

/**
 * AI 해시태그 자동 분류 추천 및 카테고리 관리 패널.
 * - `lib/tag-suggest-ai.ts`의 Claude 추천을 받아 수락/거절해요.
 * - 수락한 카테고리는 `tags_categories`, 거절한 추천은 `tags_dismissed_suggestions`에 저장돼요.
 */
export function TagCategoryPanel({
  tags,
  onSelectTag,
}: {
  tags: readonly string[];
  onSelectTag?: (tag: string) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setCategories(await listTagCategories());
  }, []);

  useEffect(() => {
    let active = true;
    void canSuggestTagsWithAi().then(
      (ok) => {
        if (active) setAllowed(ok);
      },
      () => {
        if (active) setAllowed(false);
      },
    );
    void listTagCategories().then(
      (list) => {
        if (active) setCategories(list);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const groupedCount = useMemo(() => new Set(categories.flatMap((c) => c.tags)).size, [categories]);

  const requestSuggestions = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await suggestTagCategoriesWithAi(tags);
      setSuggestions(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (suggestion: TagSuggestion) => {
    const key = tagSuggestionKey(suggestion);
    setActingKey(key);
    setError(null);
    try {
      await acceptSuggestion(suggestion);
      setSuggestions((prev) => (prev ? prev.filter((s) => tagSuggestionKey(s) !== key) : prev));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActingKey(null);
    }
  };

  const handleDismiss = async (suggestion: TagSuggestion) => {
    const key = tagSuggestionKey(suggestion);
    setActingKey(key);
    setError(null);
    try {
      await dismissSuggestion(suggestion);
      setSuggestions((prev) => (prev ? prev.filter((s) => tagSuggestionKey(s) !== key) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActingKey(null);
    }
  };

  const handleRemoveCategory = async (id: string) => {
    setError(null);
    try {
      await removeTagCategory(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            AI 해시태그 자동 분류
          </Text>
          <Text className="text-xs text-muted-foreground">
            카테고리 {categories.length}개 · 분류된 태그 {groupedCount}/{tags.length}개
          </Text>
        </View>
        {allowed ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || tags.length === 0}
            onPress={() => void requestSuggestions()}
            className={`min-h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 ${
              busy || tags.length === 0 ? 'opacity-50' : ''
            }`}
          >
            {busy ? (
              <ActivityIndicator size="small" color={palette.primaryForeground} />
            ) : (
              <Text className="text-xs font-bold text-primary-foreground">
                {suggestions ? '다시 추천' : 'AI로 분류 추천'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {allowed === false ? (
        <Text className="text-xs leading-5 text-muted-foreground">
          AI 자동 분류는 팀 AI로 해요. 설정의 계정 칸에서 팀원 계정으로 로그인하면 쓸 수 있어요.
        </Text>
      ) : null}

      {error ? <Text className="text-xs leading-5 text-destructive">{error}</Text> : null}

      {suggestions !== null ? (
        suggestions.length === 0 ? (
          <Text className="text-xs text-muted-foreground">
            새로 묶을 만한 미분류 해시태그가 없어요.
          </Text>
        ) : (
          <View className="gap-2">
            <Text className="text-xs font-bold text-primary">
              AI 추천 {suggestions.length}건 · 확인한 것만 저장돼요
            </Text>
            {suggestions.map((s) => {
              const key = tagSuggestionKey(s);
              const pending = actingKey === key;
              return (
                <View
                  key={key}
                  className="gap-2 rounded-lg border border-primary/25 bg-primary-soft p-3"
                >
                  {s.kind === 'assign' ? (
                    <Text className="text-sm font-semibold text-foreground">
                      {s.tag} → {categoryNameById.get(s.categoryId) ?? '카테고리'}
                    </Text>
                  ) : (
                    <View className="gap-1">
                      <Text className="text-sm font-semibold text-foreground">
                        새 카테고리 &ldquo;{s.name ?? '분류'}&rdquo;
                      </Text>
                      <Text className="text-xs text-muted-foreground">{s.tags.join('  ')}</Text>
                    </View>
                  )}
                  <View className="flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      disabled={pending}
                      onPress={() => void handleAccept(s)}
                      className="min-h-8 items-center justify-center rounded-md bg-primary px-3 py-1"
                    >
                      <Text className="text-xs font-bold text-primary-foreground">수락</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={pending}
                      onPress={() => void handleDismiss(s)}
                      className="min-h-8 items-center justify-center rounded-md border border-border bg-card px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-muted-foreground">거절</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )
      ) : null}

      {categories.length > 0 ? (
        <View className="gap-2 border-t border-border pt-3">
          <Text className="text-xs font-bold text-muted-foreground">내 카테고리</Text>
          {categories.map((cat) => (
            <View
              key={cat.id}
              className="gap-1.5 rounded-lg border border-border bg-background p-2.5"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold text-foreground">
                  {cat.name}{' '}
                  <Text className="text-xs font-normal text-muted-foreground">
                    ({cat.tags.length})
                  </Text>
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleRemoveCategory(cat.id)}
                  hitSlop={8}
                >
                  <Text className="text-xs text-muted-foreground">삭제</Text>
                </Pressable>
              </View>
              {cat.tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-1.5">
                  {cat.tags.map((tag) => (
                    <Pressable
                      key={tag}
                      accessibilityRole="button"
                      onPress={() => onSelectTag?.(tag)}
                      className="rounded-full bg-muted px-2.5 py-1"
                    >
                      <Text className="text-xs font-medium text-foreground">{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
