import type { Card, ExecutionRecord, ExecutionResult } from '@noteapp/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { dayKey, splitTitleAndTags, timeLabel } from '@/features/calendar';

import { loadExecution, saveExecutionRecords } from './data';
import { resultLabels, resultOrder } from './model';

const STATUS_STYLE: Record<ExecutionResult, { box: string; text: string }> = {
  done: {
    box: 'border-2 border-primary bg-primary',
    text: 'text-primary-foreground',
  },
  partial: {
    box: 'border-2 border-primary bg-primary-soft',
    text: 'text-primary-soft-foreground',
  },
  not_done: {
    box: 'border-2 border-secondary bg-secondary-soft',
    text: 'text-secondary-soft-foreground',
  },
  unknown: {
    box: 'border-2 border-input bg-muted',
    text: 'text-foreground',
  },
};

export function ExecutionScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day =
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date))
      ? date
      : dayKey(new Date());

  const [tasks, setTasks] = useState<Card[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ExecutionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    loadExecution(day)
      .then(({ tasks: loadedTasks, records }) => {
        if (!active) return;
        const taskIds = new Set(loadedTasks.map((task) => task.id));
        const nextDrafts: Record<string, ExecutionRecord> = {};
        for (const record of records) {
          if (taskIds.has(record.cardId) && !nextDrafts[record.cardId]) {
            nextDrafts[record.cardId] = record;
          }
        }
        setTasks(loadedTasks);
        setDrafts(nextDrafts);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [day, retry]);

  function choose(cardId: string, result: ExecutionResult) {
    setMessage('');
    setDrafts((previous) => ({
      ...previous,
      [cardId]: {
        ...previous[cardId],
        id: previous[cardId]?.id ?? `exec-${cardId}`,
        cardId,
        result,
        recordedAt: new Date().toISOString(),
      },
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await saveExecutionRecords(
        Object.values(drafts).map((record) => ({
          ...record,
          recordedAt: new Date().toISOString(),
        })),
      );
      setMessage('수행 기록을 저장했어요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && Object.keys(drafts).length > 0;

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-12"
    >
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">{day} 수행 확인</Text>
        <Text
          accessibilityRole="header"
          className="text-[26px] font-bold tracking-tight text-foreground"
        >
          계획한 일, 어땠나요?
        </Text>
        <Text className="text-xs text-muted-foreground">
          모름은 실패로 세지 않아요. 고른 뒤 저장해 주세요.
        </Text>
      </View>

      {loading && <ActivityIndicator accessibilityLabel="수행 기록 불러오는 중" />}

      {!!error && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text accessibilityRole="alert" className="text-sm text-destructive">
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLoading(true);
              setError('');
              setRetry((value) => value + 1);
            }}
            className="min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2"
          >
            <Text className="text-sm font-semibold text-foreground">다시 불러오기</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <>
          {!tasks.length && (
            <View className="gap-1.5 rounded-xl border border-border bg-card p-4">
              <Text className="text-sm font-semibold text-foreground">
                이 날짜에는 확인할 할 일이 없어요.
              </Text>
              <Text className="text-xs text-muted-foreground">
                캘린더에서 날짜를 눌러 할 일을 확인하고 시간을 잡아 주세요.
              </Text>
            </View>
          )}

          {tasks.map((task) => {
            const record = drafts[task.id];
            const { cleanTitle, tags } = splitTitleAndTags(task.title);
            const scheduleText = task.startAt
              ? task.endAt
                ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                : timeLabel(task.startAt)
              : '시간 미정';
            return (
              <View key={task.id} className="gap-3 rounded-xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {scheduleText}
                  </Text>
                  <View className="rounded-sm bg-task-soft px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-task">할 일</Text>
                  </View>
                </View>

                <Text className="text-base font-bold text-foreground">{cleanTitle}</Text>

                {tags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <View key={tag} className="rounded-sm bg-muted px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={`${cleanTitle} 수행 상태`}
                  className="flex-row flex-wrap gap-2"
                >
                  {resultOrder.map((result) => {
                    const selected = record?.result === result;
                    const style = selected
                      ? STATUS_STYLE[result]
                      : { box: 'border border-border bg-background', text: 'text-muted-foreground' };
                    return (
                      <Pressable
                        key={result}
                        disabled={saving}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: saving }}
                        onPress={() => choose(task.id, result)}
                        className={`min-h-11 min-w-[72px] flex-1 items-center justify-center rounded-lg px-2.5 py-2 ${style.box} ${saving ? 'opacity-50' : ''}`}
                      >
                        <Text className={`text-sm font-semibold ${style.text}`}>
                          {resultLabels[result]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {!!tasks.length && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: true, disabled: !canSave }}
              disabled={!canSave}
              onPress={() => void save()}
              className={`min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2.5 ${!canSave ? 'opacity-40' : ''}`}
            >
              <Text className="text-sm font-bold text-primary-foreground">
                {saving ? '저장 중' : '수행 기록 저장'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {!!message && (
        <View className="rounded-lg bg-primary-soft px-3 py-2">
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm font-semibold text-primary-soft-foreground"
          >
            {message}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/calendar');
        }}
        className={`min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 ${saving ? 'opacity-40' : ''}`}
      >
        <Text className="text-sm font-semibold text-foreground">닫기</Text>
      </Pressable>
    </ScrollView>
  );
}
