import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { currentUserId, onAccountChange } from '@/lib/local-first';
import { listTagCategories } from '@/lib/tag-categories';

import {
  buildCorpusFrequency,
  DEFAULT_TAG_EXTRACTION_LEVEL,
  extractAutoHashtags,
  normalizeHashtag,
  normalizeTagExtractionLevel,
  stripInlineHashtags,
  type TagExtractionLevel,
} from './autoTags';

const LEGACY_STORAGE_KEY = 'calendar:hidden-tags:v1';
const LEGACY_TAG_LEVEL_STORAGE_KEY = 'calendar:tag-level:v1';
const GUEST_OWNER = 'guest';
const overridesKeyFor = (owner: string) => `${LEGACY_STORAGE_KEY}:${owner}`;
const levelKeyFor = (owner: string) => `${LEGACY_TAG_LEVEL_STORAGE_KEY}:${owner}`;

type TagOverrides = Record<string, string[]>;

interface StoreSnapshot {
  loaded: boolean;
  overrides: TagOverrides;
  preferredTags: string[];
  corpusFreq: Map<string, number>;
  tagLevel: TagExtractionLevel;
}

let snapshot: StoreSnapshot = {
  loaded: false,
  overrides: {},
  preferredTags: [],
  corpusFreq: new Map(),
  tagLevel: DEFAULT_TAG_EXTRACTION_LEVEL,
};

let levelModifiedInMemory = false;
let loadedOwner: string | null = null;
let loadPromise: Promise<void> | undefined;
const listeners = new Set<() => void>();

async function resolveOwner(): Promise<string> {
  try {
    return (await currentUserId()) ?? GUEST_OWNER;
  } catch {
    return GUEST_OWNER;
  }
}

function emit(next: StoreSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreSnapshot {
  return snapshot;
}

function normalizeTagList(tags: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const normalized = normalizeHashtag(raw);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

async function persistOverrides(overrides: TagOverrides, owner?: string): Promise<void> {
  try {
    const targetOwner = owner ?? loadedOwner ?? (await resolveOwner());
    await AsyncStorage.setItem(overridesKeyFor(targetOwner), JSON.stringify(overrides));
  } catch {
    // 저장소 쓰기가 실패하더라도 메모리 상태는 유지해 UI가 멈추지 않게 해요.
  }
}

async function persistTagLevel(level: TagExtractionLevel, owner?: string): Promise<void> {
  try {
    const targetOwner = owner ?? loadedOwner ?? (await resolveOwner());
    await AsyncStorage.setItem(levelKeyFor(targetOwner), String(level));
  } catch {
    // 저장소 쓰기가 실패하더라도 메모리 상태는 유지해 UI가 멈추지 않게 해요.
  }
}

/** 기기 저장소의 수동 태그, 추출 강도, 사용자 태그 카테고리 목록을 불러와 내부 태그 스토어를 초기화해요. */
export async function loadHiddenTagStore(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && snapshot.loaded && !loadPromise) {
    const currentOwner = await resolveOwner();
    if (snapshot.loaded && loadedOwner === currentOwner) return;
  }
  if (loadPromise) {
    await loadPromise;
    const currentOwner = await resolveOwner();
    if (!options?.force && snapshot.loaded && loadedOwner === currentOwner) return;
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const owner = await resolveOwner();
    const ownerChanged = loadedOwner !== null && loadedOwner !== owner;
    if (ownerChanged) {
      levelModifiedInMemory = false;
    }

    let overrides: TagOverrides = ownerChanged ? {} : { ...snapshot.overrides };
    let preferredTags: string[] = ownerChanged ? [] : [...snapshot.preferredTags];
    let tagLevel: TagExtractionLevel = ownerChanged
      ? DEFAULT_TAG_EXTRACTION_LEVEL
      : snapshot.tagLevel;

    try {
      let [rawOverrides, rawLevel] = await Promise.all([
        AsyncStorage.getItem(overridesKeyFor(owner)),
        AsyncStorage.getItem(levelKeyFor(owner)),
      ]);
      if (owner === GUEST_OWNER) {
        if (rawOverrides === null) {
          const legacyOverrides = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacyOverrides !== null) {
            rawOverrides = legacyOverrides;
            void AsyncStorage.setItem(overridesKeyFor(GUEST_OWNER), legacyOverrides).catch(
              () => {},
            );
          }
        }
        if (rawLevel === null) {
          const legacyLevel = await AsyncStorage.getItem(LEGACY_TAG_LEVEL_STORAGE_KEY);
          if (legacyLevel !== null) {
            rawLevel = legacyLevel;
            void AsyncStorage.setItem(levelKeyFor(GUEST_OWNER), legacyLevel).catch(() => {});
          }
        }
      }
      if (rawOverrides) {
        const parsed = JSON.parse(rawOverrides) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const nextOverrides: TagOverrides = {};
          for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
            if (Array.isArray(list)) {
              nextOverrides[id] = normalizeTagList(
                list.filter((v): v is string => typeof v === 'string'),
              );
            }
          }
          // 같은 계정 로드 중 먼저 기록된 인메모리 변경분은 보존하고, 계정 전환 시에는 새 계정 기준으로 교체해요.
          overrides = ownerChanged ? nextOverrides : { ...nextOverrides, ...snapshot.overrides };
        }
      }
      if (rawLevel !== null && !levelModifiedInMemory) {
        tagLevel = normalizeTagExtractionLevel(rawLevel);
      } else if (!ownerChanged && levelModifiedInMemory) {
        tagLevel = snapshot.tagLevel;
      }
    } catch {
      // 손상된 로컬 JSON이나 테스트 환경에서도 기본값으로 안전하게 진행해요.
    }

    try {
      const categories = await listTagCategories();
      preferredTags = normalizeTagList(categories.flatMap((category) => category.tags));
    } catch {
      preferredTags = [];
    }

    loadedOwner = owner;
    emit({
      loaded: true,
      overrides,
      preferredTags,
      corpusFreq: snapshot.corpusFreq,
      tagLevel,
    });
  })().finally(() => {
    loadPromise = undefined;
  });

  return loadPromise;
}

onAccountChange(() => {
  void loadHiddenTagStore({ force: true });
});

/** 캘린더 전체 항목을 기준으로 코퍼스 빈도 통계를 갱신해 단건 뷰에서도 일관된 추천을 제공해요. */
export function updateCalendarTagCorpus(
  items: readonly (string | { id?: string; title: string; tags?: readonly string[] })[],
): void {
  const enriched = items.map((item) => {
    if (typeof item === 'string') return item;
    const manualTags =
      item.id && Object.prototype.hasOwnProperty.call(snapshot.overrides, item.id)
        ? snapshot.overrides[item.id]
        : item.tags;
    return { title: item.title, tags: manualTags };
  });

  emit({
    ...snapshot,
    corpusFreq: buildCorpusFrequency(enriched),
  });
}

/**
 * 레거시 제목이나 사용자 직접 입력에 `#태그`가 포함된 경우 내부 태그 저장소로 이관해요.
 * 이미 수동 편집된 항목은 덮어쓰지 않아요.
 */
export async function seedExplicitTagsFromTitle(itemId: string, title: string): Promise<void> {
  if (!itemId) return;
  const { tags } = stripInlineHashtags(title);
  if (tags.length === 0) return;
  if (Object.prototype.hasOwnProperty.call(snapshot.overrides, itemId)) return;

  const overrides: TagOverrides = {
    ...snapshot.overrides,
    [itemId]: tags,
  };
  emit({ ...snapshot, overrides });
  await persistOverrides(overrides);
}

/** 특정 일정/할 일의 내부 태그 목록을 사용자가 직접 지정한 값으로 저장해요. */
export async function setItemManualTags(itemId: string, tags: readonly string[]): Promise<void> {
  if (!itemId) return;
  const normalized = normalizeTagList(tags);
  const overrides: TagOverrides = {
    ...snapshot.overrides,
    [itemId]: normalized,
  };
  emit({ ...snapshot, overrides });
  await persistOverrides(overrides);
}

/** 수동 태그 지정을 해제하고 제목 기반 자동 추출 알고리즘으로 되돌려요. */
export async function clearItemManualTags(itemId: string): Promise<void> {
  if (!itemId) return;
  if (!Object.prototype.hasOwnProperty.call(snapshot.overrides, itemId)) return;
  const nextOverrides: TagOverrides = { ...snapshot.overrides };
  delete nextOverrides[itemId];
  emit({ ...snapshot, overrides: nextOverrides });
  await persistOverrides(nextOverrides);
}

/** 현재 설정된 해시태그 자동 추출 강도(1~5단계)를 반환해요. */
export function getTagExtractionLevel(): TagExtractionLevel {
  return snapshot.tagLevel;
}

/** 해시태그 자동 추출 강도(1~5단계)를 변경하고 기기에 저장해요. */
export async function setTagExtractionLevel(level: TagExtractionLevel): Promise<void> {
  const normalized = normalizeTagExtractionLevel(level);
  levelModifiedInMemory = true;
  emit({ ...snapshot, tagLevel: normalized });
  await persistTagLevel(normalized);
}

/** 해시태그 자동 추출 강도(1~5단계)를 구독하고 바로 변경할 수 있는 React 훅이에요. */
export function useTagExtractionLevel(): [
  TagExtractionLevel,
  (nextLevel: TagExtractionLevel) => Promise<void>,
] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void loadHiddenTagStore();
  }, []);

  const updateLevel = useCallback(async (nextLevel: TagExtractionLevel) => {
    await setTagExtractionLevel(nextLevel);
  }, []);

  return [state.tagLevel, updateLevel];
}

/** 일정/할 일 하나에 대해 최종 표시 제목(태그 제거)과 내부 해시태그 목록을 계산해요. */
export function resolveItemTags(
  itemId: string,
  title: string,
  options?: {
    corpusFreq?: ReadonlyMap<string, number>;
    level?: TagExtractionLevel;
    maxTags?: number;
    overrides?: TagOverrides;
    preferredTags?: readonly string[];
  },
): { cleanTitle: string; tags: string[]; isManual: boolean } {
  const { cleanTitle } = stripInlineHashtags(title);
  const overrides = options?.overrides ?? snapshot.overrides;
  const preferredTags = options?.preferredTags ?? snapshot.preferredTags;
  const corpusFreq = options?.corpusFreq ?? snapshot.corpusFreq;
  const level = options?.level ?? snapshot.tagLevel;

  if (itemId && Object.prototype.hasOwnProperty.call(overrides, itemId)) {
    return {
      cleanTitle,
      tags: overrides[itemId],
      isManual: true,
    };
  }

  const tags = extractAutoHashtags(title, {
    level,
    maxTags: options?.maxTags,
    corpusFreq,
    preferredTags,
  });

  return {
    cleanTitle,
    tags,
    isManual: false,
  };
}

/** 단일 일정/할 일 카드에서 내부 태그를 조회하고 수정/자동 복원할 수 있는 React 훅이에요. */
export function useItemTags(
  itemId: string,
  title: string,
  corpusFreq?: ReadonlyMap<string, number>,
): {
  cleanTitle: string;
  tags: string[];
  isManual: boolean;
  setTags: (nextTags: readonly string[]) => Promise<void>;
  resetToAuto: () => Promise<void>;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void loadHiddenTagStore();
  }, []);

  const resolved = useMemo(
    () =>
      resolveItemTags(itemId, title, {
        corpusFreq: corpusFreq ?? state.corpusFreq,
        level: state.tagLevel,
        overrides: state.overrides,
        preferredTags: state.preferredTags,
      }),
    [corpusFreq, itemId, state, title],
  );

  const setTags = useCallback(
    async (nextTags: readonly string[]) => {
      await setItemManualTags(itemId, nextTags);
    },
    [itemId],
  );

  const resetToAuto = useCallback(async () => {
    await clearItemManualTags(itemId);
  }, [itemId]);

  return {
    cleanTitle: resolved.cleanTitle,
    tags: resolved.tags,
    isManual: resolved.isManual,
    setTags,
    resetToAuto,
  };
}

/** 캘린더/그래프 화면에서 여러 항목의 코퍼스 빈도를 한 번에 집계해 내부 해시태그를 해석하는 훅이에요. */
export function useResolvedCalendarTags<T extends { id: string; title: string }>(
  items: readonly T[],
): {
  corpusFreq: ReadonlyMap<string, number>;
  byId: ReadonlyMap<string, { cleanTitle: string; tags: string[]; isManual: boolean }>;
  itemsWithTags: (T & { cleanTitle: string; tags: string[]; isManualTags: boolean })[];
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void loadHiddenTagStore();
  }, []);

  return useMemo(() => {
    const corpusInput = items.map((item) => ({
      title: item.title,
      tags: Object.prototype.hasOwnProperty.call(state.overrides, item.id)
        ? state.overrides[item.id]
        : undefined,
    }));
    const corpusFreq = buildCorpusFrequency(corpusInput);
    const byId = new Map<string, { cleanTitle: string; tags: string[]; isManual: boolean }>();

    const itemsWithTags = items.map((item) => {
      const resolved = resolveItemTags(item.id, item.title, {
        corpusFreq,
        level: state.tagLevel,
        overrides: state.overrides,
        preferredTags: state.preferredTags,
      });
      byId.set(item.id, resolved);
      return {
        ...item,
        cleanTitle: resolved.cleanTitle,
        tags: resolved.tags,
        isManualTags: resolved.isManual,
      };
    });

    return { corpusFreq, byId, itemsWithTags };
  }, [items, state]);
}
