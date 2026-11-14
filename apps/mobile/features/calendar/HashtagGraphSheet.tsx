import type { CalendarEvent, Card } from '@noteapp/shared';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarButton, useCalendarTheme } from './design';
import { buildHashtagGraph } from './hashtags';

const graphHeight = 216;
const nodeWidth = 80;
const branchLimit = 6;

export function HashtagGraphSheet({
  events,
  tasks,
  onClose,
}: {
  events: readonly CalendarEvent[];
  tasks: readonly Card[];
  onClose: () => void;
}) {
  const [selectedTag, setSelectedTag] = useState<string>();
  const { styles } = useCalendarTheme();
  const graph = useMemo(
    () => buildHashtagGraph([...events, ...tasks.filter((task) => task.status !== 'dismissed')]),
    [events, tasks],
  );
  const selected =
    graph.find((node) => node.tag === selectedTag) ??
    graph.find((node) => node.links.size > 0) ??
    graph[0];
  const related = [...(selected?.links ?? [])].sort(
    ([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b, 'ko'),
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.row}>
            <Text accessibilityRole="header" style={styles.title}>
              해시태그 연결망
            </Text>
            <CalendarButton label="닫기" onPress={onClose} />
          </View>
          {selected ? (
            <>
              <Text style={styles.muted}>같은 일정이나 할 일에 나온 태그를 연결해요.</Text>
              <TagMap
                selected={selected.tag}
                neighbors={related.slice(0, branchLimit).map(([tag]) => tag)}
                onSelect={setSelectedTag}
              />
              <Text accessibilityRole="header" style={styles.heading}>
                함께 쓰인 태그
              </Text>
              {related.length ? (
                <View style={styles.row}>
                  {related.map(([tag, count]) => (
                    <CalendarButton
                      key={tag}
                      label={`${tag} (${count})`}
                      onPress={() => setSelectedTag(tag)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>함께 쓰인 태그가 없어요.</Text>
              )}
              <Text accessibilityRole="header" style={styles.heading}>
                {selected.tag} 관련 일정 및 할 일 {selected.items.length}개
              </Text>
              {selected.items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.text}>{item.title}</Text>
                </View>
              ))}
              <Text accessibilityRole="header" style={styles.heading}>
                전체 태그
              </Text>
              <View style={styles.row}>
                {graph.map(({ tag }) => (
                  <CalendarButton
                    key={tag}
                    label={tag}
                    selected={tag === selected.tag}
                    onPress={() => setSelectedTag(tag)}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>일정이나 할 일 제목에 해시태그가 없어요.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TagMap({
  selected,
  neighbors,
  onSelect,
}: {
  selected: string;
  neighbors: string[];
  onSelect: (tag: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const { colors, styles } = useCalendarTheme();
  const centerX = width / 2;
  const centerY = graphHeight / 2;
  // 선택한 태그를 중심에 두고, 함께 나온 태그를 타원 둘레에 배치해요.
  const nodes = neighbors.map((tag, index) => {
    const angle = (index / neighbors.length) * 2 * Math.PI - Math.PI / 2;
    return {
      tag,
      dx: Math.cos(angle) * Math.max(0, centerX - nodeWidth / 2 - 8),
      dy: Math.sin(angle) * (centerY - 24),
    };
  });

  return (
    <View
      style={[styles.card, { height: graphHeight, overflow: 'hidden' }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 &&
        nodes.map(({ tag, dx, dy }) => {
          const length = Math.hypot(dx, dy);
          return (
            <View
              key={tag}
              pointerEvents="none"
              style={{
                position: 'absolute',
                height: 2,
                backgroundColor: colors.primary,
                width: length,
                left: centerX + dx / 2 - length / 2,
                top: centerY + dy / 2 - 1,
                transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
              }}
            />
          );
        })}
      {width > 0 &&
        [...nodes, { tag: selected, dx: 0, dy: 0 }].map(({ tag, dx, dy }) => (
          <View
            key={tag}
            style={{
              position: 'absolute',
              width: nodeWidth,
              left: centerX + dx - nodeWidth / 2,
              top: centerY + dy - 22,
            }}
          >
            <CalendarButton
              label={tag}
              selected={tag === selected}
              singleLine
              onPress={() => onSelect(tag)}
            />
          </View>
        ))}
    </View>
  );
}
