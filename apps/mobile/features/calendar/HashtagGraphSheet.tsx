import type { CalendarEvent, Card } from '@noteapp/shared';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HashtagLevelBar } from './HashtagLevelBar';
import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import {
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

function PillButton({
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
      className={`min-h-10 items-center justify-center rounded-lg border px-3.5 py-2 ${
        selected ? 'border-primary bg-primary' : 'border-border bg-card'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-sm font-semibold ${
          selected ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
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

  const graph = useMemo(() => buildHashtagGraph(items), [items]);
  const selected =
    graph.find((n) => n.tag === selectedTag) ?? graph.find((n) => n.links.size > 0) ?? graph[0];
  const stats = useMemo(() => {
    let edges = 0;
    const ids = new Set<string>();
    for (const node of graph) {
      edges += node.links.size;
      for (const item of node.items) ids.add(item.id);
    }
    return { nodes: graph.length, edges: Math.floor(edges / 2), items: ids.size };
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

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
                해시태그 연결망
              </Text>
              <Text className="text-xs text-muted-foreground">
                같은 일정이나 할 일에 함께 쓰인 주제 태그들이 신경망처럼 연결돼요.
              </Text>
            </View>
            <PillButton label="닫기" onPress={onClose} />
          </View>

          {selected ? (
            <>
              <View className="flex-row flex-wrap gap-2 rounded-xl border border-border bg-muted p-3">
                {[
                  ['해시태그 노드', `${stats.nodes}개`],
                  ['신경망 연결선', `${stats.edges}개`],
                  ['태그된 일정, 할 일', `${stats.items}개`],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    className="flex-row items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5"
                  >
                    <Text className="text-xs text-muted-foreground">{label}</Text>
                    <Text className="text-xs font-bold text-foreground">{value}</Text>
                  </View>
                ))}
              </View>

              <HashtagLevelBar compact />

              <TagCategoryPanel tags={graph.map((n) => n.tag)} onSelectTag={setSelectedTag} />

              <View className="gap-3 rounded-xl border border-border bg-card p-4">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="flex-row rounded-lg bg-muted p-1">
                    {[
                      [true, '핵심 연결만'],
                      [false, '모든 연결선'],
                    ].map(([val, label]) => (
                      <Pressable
                        key={String(label)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: backboneOnly === val }}
                        onPress={() => setBackboneOnly(Boolean(val))}
                        className={`rounded-md px-3 py-1.5 ${backboneOnly === val ? 'bg-background' : ''}`}
                      >
                        <Text
                          className={`text-xs font-bold ${backboneOnly === val ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {String(label)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View className="flex-row rounded-lg bg-muted p-1">
                    {(
                      [
                        ['all', '전체 범위'],
                        [1, '1촌 연결'],
                        [2, '2촌 연결'],
                      ] as const
                    ).map(([val, label]) => (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityState={{ selected: scope === val }}
                        onPress={() => setScope(val)}
                        className={`rounded-md px-3 py-1.5 ${scope === val ? 'bg-background' : ''}`}
                      >
                        <Text
                          className={`text-xs font-bold ${scope === val ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="flex-row flex-wrap items-center gap-2">
                  <TextInput
                    accessibilityLabel="해시태그 검색"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="태그 검색 (예: 기획, 개발, 인공지능, 운동)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="h-11 min-w-[200px] flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  {query.length > 0 && <PillButton label="지우기" onPress={() => setQuery('')} />}
                  <PillButton
                    label="축소"
                    disabled={zoomIndex <= 0}
                    onPress={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  />
                  <PillButton
                    label="기본 크기"
                    selected={zoomIndex === 1}
                    onPress={() => setZoomIndex(1)}
                  />
                  <PillButton
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
                          <PillButton
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
              </View>

              <View className={`gap-2 rounded-xl border-2 bg-card p-4 ${selectedStyle.border}`}>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
                    {selected.tag}
                  </Text>
                  <Text className="text-xs font-semibold text-muted-foreground">
                    연결 태그 {selected.links.size}개, 관련 항목 {selected.items.length}개
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  노드를 누르면 중심 태그가 바뀌고, 연결된 1촌, 2촌 신경망이 강조돼요.
                </Text>
              </View>

              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                함께 쓰인 태그 ({related.length}개)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {related.length ? (
                  related.map(([tag, count]) => (
                    <PillButton
                      key={tag}
                      label={`${tag} (${count})`}
                      onPress={() => setSelectedTag(tag)}
                    />
                  ))
                ) : (
                  <Text className="text-xs text-muted-foreground">함께 쓰인 태그가 없어요.</Text>
                )}
              </View>

              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                {selected.tag} 관련 일정 및 할 일 ({selected.items.length}개)
              </Text>
              {selected.items.map((item) => (
                <View
                  key={item.id}
                  className="gap-1.5 rounded-xl border border-border bg-card p-3.5"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View
                      className={`rounded-sm px-2 py-0.5 ${item.kind === 'task' ? 'bg-task-soft' : 'bg-cal-1-soft'}`}
                    >
                      <Text
                        className={`text-xs font-bold ${item.kind === 'task' ? 'text-task' : 'text-cal-1'}`}
                      >
                        {item.kind === 'task' ? '할 일' : '일정'}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {item.startAt
                        ? item.endAt
                          ? `${dayKey(item.startAt)} (${timeLabel(item.startAt)} ~ ${timeLabel(item.endAt)})`
                          : dayKey(item.startAt)
                        : '시간 미정'}
                    </Text>
                  </View>
                  <Text className="text-sm text-foreground">{item.title}</Text>
                  <HiddenTagDisclosure
                    itemId={item.id}
                    title={item.title}
                    corpusFreq={corpusFreq}
                    compact
                    onPressTag={setSelectedTag}
                  />
                </View>
              ))}

              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                전체 태그 목록 ({filteredTags.length}개)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {filteredTags.map(({ tag, items: list }) => (
                  <PillButton
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
              const thickness = edge.active ? 2 + Math.min(2.5, edge.weight * 0.5) : 1.2;
              return (
                <View
                  key={edge.key}
                  pointerEvents="none"
                  className={
                    edge.active
                      ? `absolute ${activeStyle.bg}`
                      : 'absolute bg-muted-foreground opacity-30'
                  }
                  style={{
                    height: thickness,
                    width: length,
                    left: (edge.x1 + edge.x2) / 2 - length / 2,
                    top: (edge.y1 + edge.y2) / 2 - thickness / 2,
                    opacity: edge.active ? 0.92 : 0.28,
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
                  accessibilityLabel={`${node.tag}, 연결 ${node.links.size}개, 항목 ${node.items.length}개`}
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
