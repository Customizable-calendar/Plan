import type { CalendarEvent, Card } from '@noteapp/shared';
import { Button, DaySectionTitle, Icon, Input, RailCard, SegmentTabs, Text } from '@noteapp/ui';
import { XIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { embedTagsWithLocalModel, useLocalEmbeddingModel } from './embeddingEngine';
import { computeSemanticLinks } from './embeddingMath';
import { EmbeddingModelCard } from './EmbeddingModelCard';
import { HashtagLevelBar } from './HashtagLevelBar';
import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import {
  buildHashtagEdges,
  buildHashtagGraph,
  type CalendarTagItem,
  layoutHashtagGraph,
  type TagNode,
} from './hashtags';
import { dayKey, timeLabel } from './model';
import { TagCategoryPanel } from './TagCategoryPanel';
import { useResolvedCalendarTags } from './tagStore';

const BASE_GRAPH_HEIGHT = 480;
const ZOOM_STEPS = [0.85, 1, 1.3, 1.6] as const;
type ScopeMode = 'all' | 1 | 2;

const CLUSTER_STYLES = [
  { bg: 'bg-primary', border: 'border-primary' },
  { bg: 'bg-cal-1', border: 'border-cal-1' },
  { bg: 'bg-cal-2', border: 'border-cal-2' },
  { bg: 'bg-event', border: 'border-event' },
  { bg: 'bg-person', border: 'border-person' },
  { bg: 'bg-idea', border: 'border-idea' },
] as const;

function TagPillButton({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-8 items-center justify-center rounded-full border px-3 ${
        selected ? 'border-foreground bg-foreground' : 'border-border bg-background'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-[13px] ${selected ? 'font-bold text-background' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HashtagGraphSheet({
  events,
  tasks,
  initialTag,
  onClose,
}: {
  events: readonly CalendarEvent[];
  tasks: readonly Card[];
  initialTag?: string;
  onClose: () => void;
}) {
  const [selectedTag, setSelectedTag] = useState<string | undefined>(initialTag);
  const [scope, setScope] = useState<ScopeMode>('all');
  const [backboneOnly, setBackboneOnly] = useState(true);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [query, setQuery] = useState('');
  const [modelVectors, setModelVectors] = useState<Map<string, Float32Array> | null>(null);
  const embeddingModel = useLocalEmbeddingModel();

  const rawItems = useMemo(
    () => [
      ...events.map((e) => ({
        id: e.id,
        title: e.title,
        kind: 'event' as const,
        startAt: e.startAt,
        endAt: e.endAt,
      })),
      ...tasks
        .filter((t) => t.status !== 'dismissed')
        .map((t) => ({
          id: t.id,
          title: t.title,
          kind: 'task' as const,
          startAt: t.startAt,
          endAt: t.endAt,
        })),
    ],
    [events, tasks],
  );

  const { itemsWithTags, corpusFreq } = useResolvedCalendarTags(rawItems);
  const items = useMemo<CalendarTagItem[]>(
    () =>
      itemsWithTags.map((item) => ({
        id: item.id,
        title: item.cleanTitle,
        kind: item.kind,
        startAt: item.startAt,
        endAt: item.endAt,
        tags: item.tags,
      })),
    [itemsWithTags],
  );

  const tagContextInputs = useMemo(() => {
    const titlesByTag = new Map<string, string[]>();
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        const list = titlesByTag.get(tag) ?? [];
        if (list.length < 3) {
          list.push(item.title);
          titlesByTag.set(tag, list);
        }
      }
    }
    return [...titlesByTag.entries()].map(([tag, titles]) => ({
      tag,
      contextText: titles.join(' '),
    }));
  }, [items]);

  useEffect(() => {
    if (!embeddingModel.downloaded || tagContextInputs.length === 0) return;
    let active = true;
    void embedTagsWithLocalModel(tagContextInputs).then(
      (vecs) => {
        if (active) setModelVectors(vecs);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [embeddingModel.downloaded, tagContextInputs]);

  const activeVectors = embeddingModel.downloaded ? modelVectors : null;
  const semanticLinks = useMemo(
    () => computeSemanticLinks(items, { vectors: activeVectors ?? undefined }),
    [items, activeVectors],
  );

  const graph = useMemo(() => buildHashtagGraph(items, { semanticLinks }), [items, semanticLinks]);
  const selected =
    graph.find((n) => n.tag === selectedTag) ??
    graph.find((n) => n.links.size > 0 || (n.semanticLinks?.size ?? 0) > 0) ??
    graph[0];
  const stats = useMemo(() => {
    const edges = buildHashtagEdges(graph);
    const ids = new Set<string>();
    for (const node of graph) {
      for (const item of node.items) ids.add(item.id);
    }
    return {
      nodes: graph.length,
      edges: edges.length,
      items: ids.size,
    };
  }, [graph]);

  const legend = useMemo(() => {
    const reps = new Map<number, TagNode>();
    for (const node of graph) if (!reps.has(node.cluster)) reps.set(node.cluster, node);
    return [...reps.entries()].sort(([a], [b]) => a - b);
  }, [graph]);

  const related = useMemo(
    () =>
      selected
        ? [...selected.links.entries()].sort(
            ([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, 'ko'),
          )
        : [],
    [selected],
  );
  const relatedSemantic = useMemo(
    () =>
      selected?.semanticLinks
        ? [...selected.semanticLinks.entries()].sort(
            ([a, am], [b, bm]) => bm.similarity - am.similarity || a.localeCompare(b, 'ko'),
          )
        : [],
    [selected],
  );
  const normalizedQuery = query.trim().toLowerCase().replace(/^#+/, '');
  const filteredTags = useMemo(
    () => (normalizedQuery ? graph.filter((n) => n.tag.slice(1).includes(normalizedQuery)) : graph),
    [graph, normalizedQuery],
  );
  const matchedTags = useMemo(
    () => (normalizedQuery ? new Set(filteredTags.map((n) => n.tag)) : undefined),
    [filteredTags, normalizedQuery],
  );
  const selectedStyle = selected
    ? CLUSTER_STYLES[selected.cluster % CLUSTER_STYLES.length]
    : CLUSTER_STYLES[0];

  const scopeLabel = scope === 'all' ? '전체 범위' : scope === 1 ? '1촌 연결' : '2촌 연결';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between gap-3 border-b border-border pb-3">
            <View className="flex-1 gap-0.5">
              <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
                해시태그 연결망
              </Text>
              <Text className="text-xs text-muted-foreground">
                같은 일정에 함께 쓰였거나 뜻이 비슷한 태그들이 신경망처럼 연결돼요.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon as={XIcon} size={20} className="text-foreground" />
            </Pressable>
          </View>

          {selected ? (
            <>
              <View className="flex-row flex-wrap gap-3">
                {[
                  ['해시태그 노드', `${stats.nodes}개`],
                  ['신경망 연결선', `${stats.edges}개`],
                  ['태그된 일정, 할 일', `${stats.items}개`],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1"
                  >
                    <Text className="text-xs text-muted-foreground">{label}</Text>
                    <Text className="text-xs font-bold text-foreground">{value}</Text>
                  </View>
                ))}
              </View>

              <HashtagLevelBar compact />

              <EmbeddingModelCard compact />

              <TagCategoryPanel tags={graph.map((n) => n.tag)} onSelectTag={setSelectedTag} />

              <View className="gap-3 border-t border-border pt-4">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <SegmentTabs
                    items={['핵심 연결만', '모든 연결선']}
                    active={backboneOnly ? '핵심 연결만' : '모든 연결선'}
                    onChange={(label) => setBackboneOnly(label === '핵심 연결만')}
                  />
                  <SegmentTabs
                    items={['전체 범위', '1촌 연결', '2촌 연결']}
                    active={scopeLabel}
                    onChange={(label) =>
                      setScope(label === '전체 범위' ? 'all' : label === '1촌 연결' ? 1 : 2)
                    }
                  />
                </View>

                <View className="flex-row flex-wrap items-center gap-2">
                  <Input
                    accessibilityLabel="해시태그 검색"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="태그 검색 (예: 기획, 개발, 인공지능, 운동)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="h-10 min-w-[200px] flex-1"
                  />
                  {query.length > 0 && (
                    <Button variant="ghost" size="sm" onPress={() => setQuery('')}>
                      <Text>지우기</Text>
                    </Button>
                  )}
                  <TagPillButton
                    label="축소"
                    disabled={zoomIndex <= 0}
                    onPress={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  />
                  <TagPillButton
                    label="기본 크기"
                    selected={zoomIndex === 1}
                    onPress={() => setZoomIndex(1)}
                  />
                  <TagPillButton
                    label="확대"
                    disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                    onPress={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                  />
                </View>

                {normalizedQuery.length > 0 && (
                  <View className="flex-row flex-wrap gap-2">
                    {filteredTags.length > 0 ? (
                      filteredTags
                        .slice(0, 8)
                        .map((n) => (
                          <TagPillButton
                            key={n.tag}
                            label={`${n.tag} (${n.items.length})`}
                            selected={n.tag === selected.tag}
                            onPress={() => setSelectedTag(n.tag)}
                          />
                        ))
                    ) : (
                      <Text className="text-xs text-muted-foreground">
                        검색 조건에 맞는 해시태그가 없어요.
                      </Text>
                    )}
                  </View>
                )}

                <ObsidianGraphCanvas
                  graph={graph}
                  selectedTag={selected.tag}
                  scope={scope}
                  backboneOnly={backboneOnly}
                  zoom={ZOOM_STEPS[zoomIndex]}
                  matchedTags={matchedTags}
                  onSelect={setSelectedTag}
                />

                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    {legend.map(([clusterId, rep]) => (
                      <Pressable
                        key={clusterId}
                        accessibilityRole="button"
                        onPress={() => setSelectedTag(rep.tag)}
                        className="flex-row items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"
                      >
                        <View
                          className={`h-2.5 w-2.5 rounded-full ${CLUSTER_STYLES[clusterId % CLUSTER_STYLES.length].bg}`}
                        />
                        <Text className="text-xs text-muted-foreground">
                          군집 {clusterId + 1} ({rep.tag})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    실선 함께 쓰임, 점선 비슷한 뜻
                  </Text>
                </View>
              </View>

              <View className={`gap-1 border-l-4 pl-3 ${selectedStyle.border}`}>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
                    {selected.tag}
                  </Text>
                  <Text className="text-xs font-semibold text-muted-foreground">
                    연결 {selected.links.size + relatedSemantic.length}개, 관련 항목{' '}
                    {selected.items.length}개
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  노드를 누르면 중심 태그가 바뀌고, 연결된 1촌, 2촌 신경망이 강조돼요.
                </Text>
              </View>

              <DaySectionTitle label="함께 쓰인 태그" count={related.length} />
              <View className="flex-row flex-wrap gap-2">
                {related.length ? (
                  related.map(([tag, count]) => (
                    <TagPillButton
                      key={tag}
                      label={`${tag} (${count})`}
                      onPress={() => setSelectedTag(tag)}
                    />
                  ))
                ) : (
                  <Text className="text-xs text-muted-foreground">함께 쓰인 태그가 없어요.</Text>
                )}
              </View>

              {relatedSemantic.length > 0 ? (
                <>
                  <DaySectionTitle label="비슷한 태그" count={relatedSemantic.length} />
                  <View className="flex-row flex-wrap gap-2">
                    {relatedSemantic.map(([tag, meta]) => (
                      <TagPillButton
                        key={tag}
                        label={`${tag} (${Math.round(meta.similarity * 100)}%)`}
                        onPress={() => setSelectedTag(tag)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <DaySectionTitle
                label={`${selected.tag} 관련 일정 및 할 일`}
                count={selected.items.length}
              />
              <View>
                {selected.items.map((item, idx) => {
                  const whenText = item.startAt
                    ? item.endAt
                      ? `${dayKey(item.startAt)} (${timeLabel(item.startAt)} ~ ${timeLabel(item.endAt)})`
                      : dayKey(item.startAt)
                    : '시간 미정';
                  return (
                    <View key={item.id}>
                      {idx > 0 ? <View className="h-px bg-border" /> : null}
                      <RailCard
                        type={item.kind === 'task' ? 'task' : 'event'}
                        title={item.title}
                        meta={whenText}
                      />
                      <View className="pb-2">
                        <HiddenTagDisclosure
                          itemId={item.id}
                          title={item.title}
                          corpusFreq={corpusFreq}
                          compact
                          onPressTag={setSelectedTag}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>

              <DaySectionTitle label="전체 태그 목록" count={filteredTags.length} />
              <View className="flex-row flex-wrap gap-2">
                {filteredTags.map(({ tag, items: list }) => (
                  <TagPillButton
                    key={tag}
                    label={`${tag} (${list.length})`}
                    selected={tag === selected.tag}
                    onPress={() => setSelectedTag(tag)}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text className="text-sm text-muted-foreground">
              일정이나 할 일에서 추출된 해시태그가 없어요.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ObsidianGraphCanvas({
  graph,
  selectedTag,
  scope,
  backboneOnly,
  zoom,
  matchedTags,
  onSelect,
}: {
  graph: readonly TagNode[];
  selectedTag: string;
  scope: ScopeMode;
  backboneOnly: boolean;
  zoom: number;
  matchedTags?: ReadonlySet<string>;
  onSelect: (tag: string) => void;
}) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const canvasWidth =
    viewportWidth > 0 ? Math.max(viewportWidth, Math.round(viewportWidth * zoom)) : 0;
  const canvasHeight = Math.round(BASE_GRAPH_HEIGHT * zoom);
  const layout = useMemo(
    () =>
      canvasWidth > 0
        ? layoutHashtagGraph(graph, {
            width: canvasWidth,
            height: canvasHeight,
            focusTag: selectedTag,
            maxHops: scope === 'all' ? undefined : scope,
            backboneOnly,
          })
        : { nodes: [], edges: [] },
    [graph, canvasWidth, canvasHeight, selectedTag, scope, backboneOnly],
  );
  const selectedNode = layout.nodes.find((n) => n.tag === selectedTag);
  const activeStyle = selectedNode
    ? CLUSTER_STYLES[selectedNode.cluster % CLUSTER_STYLES.length]
    : CLUSTER_STYLES[0];

  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-background"
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
    >
      {canvasWidth > 0 && (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={zoom > 1}
          contentContainerStyle={{ minWidth: viewportWidth }}
        >
          <View
            accessibilityLabel="옵시디언 해시태그 신경망 그래프"
            className="relative"
            style={{ width: canvasWidth, height: canvasHeight }}
          >
            {layout.edges.map((edge) => {
              const dx = edge.x2 - edge.x1,
                dy = edge.y2 - edge.y1,
                length = Math.hypot(dx, dy);
              if (length <= 0) return null;
              const isSemantic = edge.kind === 'semantic';
              const thickness = edge.active ? 2 + Math.min(2.5, edge.weight * 0.5) : 1.2;
              return (
                <View
                  key={edge.key}
                  pointerEvents="none"
                  className={
                    isSemantic
                      ? edge.active
                        ? 'absolute border-t-2 border-dashed border-ai'
                        : 'absolute border-t border-dashed border-ai/60'
                      : edge.active
                        ? `absolute ${activeStyle.bg}`
                        : 'absolute bg-muted-foreground opacity-30'
                  }
                  style={{
                    height: isSemantic ? 0 : thickness,
                    width: length,
                    left: (edge.x1 + edge.x2) / 2 - length / 2,
                    top: (edge.y1 + edge.y2) / 2 - (isSemantic ? 1 : thickness / 2),
                    opacity: edge.active ? 0.92 : isSemantic ? 0.52 : 0.28,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  }}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const style = CLUSTER_STYLES[node.cluster % CLUSTER_STYLES.length];
              const isSelected = node.hop === 0;
              const isMatched = matchedTags ? matchedTags.has(node.tag) : true;
              const isDimmed =
                (scope === 'all' && node.hop > 1 && (!matchedTags || !isMatched)) ||
                (Boolean(matchedTags) && !isMatched && !isSelected);
              const dotSize = node.radius * 2,
                haloSize = dotSize + 10;
              return (
                <Pressable
                  key={node.tag}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${node.tag}, 연결 ${node.links.size + (node.semanticLinks?.size ?? 0)}개, 항목 ${node.items.length}개`}
                  onPress={() => onSelect(node.tag)}
                  className="absolute items-center"
                  style={{
                    left: node.x - 48,
                    top: node.y - haloSize / 2,
                    width: 96,
                    opacity: isDimmed ? 0.42 : 1,
                    zIndex: isSelected ? 20 : node.hop === 1 ? 10 : 1,
                  }}
                >
                  <View
                    className="items-center justify-center"
                    style={{ width: haloSize, height: haloSize }}
                  >
                    {isSelected && (
                      <View
                        pointerEvents="none"
                        className={`absolute rounded-full border-2 bg-background ${style.border}`}
                        style={{ width: haloSize, height: haloSize }}
                      />
                    )}
                    <View
                      className={`items-center justify-center rounded-full border border-background ${style.bg}`}
                      style={{ width: dotSize, height: dotSize }}
                    >
                      <Text className="text-[11px] font-bold text-primary-foreground">
                        {node.items.length}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`mt-0.5 rounded-sm px-1.5 py-0.5 ${isSelected ? style.bg : `border bg-card ${isMatched && matchedTags ? style.border : 'border-border'}`}`}
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-[11px] font-semibold ${isSelected ? 'font-bold text-primary-foreground' : 'text-foreground'}`}
                    >
                      {node.tag}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
