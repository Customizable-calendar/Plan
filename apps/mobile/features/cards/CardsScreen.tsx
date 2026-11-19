import type { Card, CardType } from '@noteapp/shared';
import {
  ActionRow,
  BottomSheet,
  CardListRow,
  DaySectionTitle,
  Scrim,
  ScrollChips,
  SwipeRow,
  Text,
} from '@noteapp/ui';
import { Link } from 'expo-router';
import { CheckIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cardDetail, typeLabel } from './format';
import { confirmCard, confirmCards, dismissCard, restoreCard, useCards } from './store';
import { TryMemo } from './TryMemo';
import { UndoBar } from './UndoBar';

const TYPE_KEYS: (CardType | 'all')[] = ['all', 'event', 'task', 'person', 'idea'];
const TYPE_DOT: Record<CardType, string> = {
  event: 'bg-event',
  task: 'bg-task',
  person: 'bg-person',
  idea: 'bg-idea',
};

/** memo: 맨 위에 둘 막 쓰기 칸. 라우트가 notes 기능의 입력을 넣어 줘요. 없으면 TryMemo를 써요. */
export function CardsScreen({ memo }: { memo?: ReactNode }) {
  const { cards, loading } = useCards();
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [moreId, setMoreId] = useState<string | null>(null);

  const live = cards.filter((c) => c.status !== 'dismissed');
  const shown = cards.filter((c) => filter === 'all' || c.type === filter);
  const waiting = shown.filter((c) => c.status === 'suggested');
  const confirmed = shown.filter((c) => c.status === 'confirmed');
  const dismissed = shown.filter((c) => c.status === 'dismissed');
  const picked = cards.find((c) => c.id === moreId) ?? null;

  const chips = TYPE_KEYS.map((key) => ({
    key,
    label: key === 'all' ? '전체' : typeLabel[key],
    count: key === 'all' ? live.length : live.filter((c) => c.type === key).length,
    dot: key === 'all' ? undefined : TYPE_DOT[key],
  }));

  const renderRows = (items: Card[]) =>
    items.map((c, index) => (
      <View key={c.id}>
        {index > 0 ? <View className="h-px bg-border" /> : null}
        <SwipeRow
          onConfirm={c.status === 'suggested' ? () => void confirmCard(c.id) : undefined}
          onDismiss={() => void dismissCard(c.id)}
        >
          <CardListRow
            type={c.type}
            title={c.title}
            meta={cardDetail(c) ?? undefined}
            state={c.status}
            selected={c.id === moreId}
            onConfirm={() => void confirmCard(c.id)}
            onMore={() => setMoreId(c.id)}
          />
        </SwipeRow>
      </View>
    ));

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-28 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5">{memo ?? <TryMemo />}</View>

        <ScrollChips
          items={chips}
          active={filter}
          onChange={(k) => setFilter(k as CardType | 'all')}
        />

        {loading ? <Text className="px-5 text-sm text-muted-foreground">불러오는 중</Text> : null}

        <View className="px-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <DaySectionTitle label="확인 기다리는 카드" count={waiting.length} />
            </View>
            {waiting.length > 1 ? (
              <Pressable
                onPress={() => void confirmCards(waiting.map((c) => c.id))}
                accessibilityRole="button"
                hitSlop={8}
                className="h-9 justify-center pl-3"
              >
                <Text className="text-[13px] font-bold text-primary">모두 확인</Text>
              </Pressable>
            ) : null}
          </View>
          {waiting.length === 0 && !loading ? (
            <Text className="py-3 text-sm text-muted-foreground">모두 확인했어요.</Text>
          ) : (
            renderRows(waiting)
          )}
        </View>

        {confirmed.length > 0 ? (
          <View className="px-5">
            <DaySectionTitle label="확인한 카드" count={confirmed.length} />
            {renderRows(confirmed)}
            <View className="h-px bg-border" />
            <Link href="/draft" className="py-3.5 text-[15px] font-bold text-primary">
              확인한 카드로 초안 만들기
            </Link>
          </View>
        ) : null}

        {dismissed.length > 0 ? (
          <View className="px-5">
            <DaySectionTitle label="버린 카드" count={dismissed.length} />
            {dismissed.map((c, index) => (
              <View key={c.id}>
                {index > 0 ? <View className="h-px bg-border" /> : null}
                <Pressable
                  onPress={() => void restoreCard(c.id)}
                  accessibilityRole="button"
                  className="min-h-12 flex-row items-center justify-between gap-3 py-2.5"
                >
                  <Text
                    className="flex-1 text-sm text-muted-foreground line-through"
                    numberOfLines={1}
                  >
                    {typeLabel[c.type]}, {c.title}
                  </Text>
                  <Text className="text-[13px] font-bold text-primary">되살리기</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {picked ? (
        <>
          <Pressable
            onPress={() => setMoreId(null)}
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Scrim />
          </Pressable>
          <View className="absolute bottom-0 left-0 right-0">
            <BottomSheet title={picked.title}>
              {picked.status === 'suggested' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void confirmCard(picked.id);
                    setMoreId(null);
                  }}
                >
                  <ActionRow icon={CheckIcon} label="확인해서 저장" />
                </Pressable>
              ) : null}
              {picked.status === 'dismissed' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void restoreCard(picked.id);
                    setMoreId(null);
                  }}
                >
                  <ActionRow icon={RotateCcwIcon} label="되살리기" />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void dismissCard(picked.id);
                    setMoreId(null);
                  }}
                >
                  <ActionRow icon={Trash2Icon} label="버리기" />
                </Pressable>
              )}
            </BottomSheet>
          </View>
        </>
      ) : null}

      <UndoBar floating />
    </View>
  );
}
