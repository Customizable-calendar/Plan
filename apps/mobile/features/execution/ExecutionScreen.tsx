import type { Card, ExecutionRecord, ExecutionResult } from '@noteapp/shared';
import { Button, CompletionBar, StatusPicker, TaskCheckRow, Text, type Status } from '@noteapp/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { dayKey, HiddenTagDisclosure, splitTitleAndTags, timeLabel } from '@/features/calendar';

import { loadExecution, saveExecutionRecords } from './data';

const toUiStatus = (r?: ExecutionResult): Status | undefined => (r === 'not_done' ? 'missed' : r);

const fromUiStatus = (s: Status): ExecutionResult => (s === 'missed' ? 'not_done' : s);

// 수행 확인 시트. 디자인 시스템 개편안(동그라미 한 번으로 완료, 줄을 누르면 4가지 펼치기, 진행 숫자)을 따라요.
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
  const [openId, setOpenId] = useState<string | null>(null);
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

  function toggleQuickDone(cardId: string) {
    const current = drafts[cardId]?.result;
    if (current === 'done') {
      setMessage('');
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[cardId];
        return next;
      });
    } else {
      choose(cardId, 'done');
    }
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
  const doneCount = tasks.filter((t) => drafts[t.id]?.result === 'done').length;
  const partialCount = tasks.filter((t) => drafts[t.id]?.result === 'partial').length;
  const missedCount = tasks.filter((t) => drafts[t.id]?.result === 'not_done').length;

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-5 p-5 pb-12"
    >
      <View className="gap-1">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xs text-muted-foreground">{day} 수행 확인</Text>
          {tasks.length > 0 ? (
            <Text className="text-sm font-bold text-primary">
              {doneCount}/{tasks.length} 완료
            </Text>
          ) : null}
        </View>
        <Text
          accessibilityRole="header"
          className="text-[26px] font-bold tracking-tight text-foreground"
        >
          계획한 일, 어땠나요?
        </Text>
      </View>

      {tasks.length > 0 ? (
        <CompletionBar done={doneCount} partial={partialCount} missed={missedCount} />
      ) : null}

      {loading ? <ActivityIndicator accessibilityLabel="수행 기록 불러오는 중" /> : null}

      {!!error ? (
        <View className="gap-3 border-t border-border pt-4">
          <Text accessibilityRole="alert" className="text-sm text-destructive">
            {error}
          </Text>
          <Button
            variant="outline"
            onPress={() => {
              setLoading(true);
              setError('');
              setRetry((value) => value + 1);
            }}
          >
            <Text>다시 불러오기</Text>
          </Button>
        </View>
      ) : null}

      {!loading && !error ? (
        <>
          {!tasks.length ? (
            <Text className="py-4 text-sm text-muted-foreground">
              이 날짜에는 확인할 할 일이 없어요.
            </Text>
          ) : (
            <View>
              {tasks.map((task, index) => {
                const record = drafts[task.id];
                const { cleanTitle } = splitTitleAndTags(task.title);
                const scheduleText = task.startAt
                  ? task.endAt
                    ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                    : timeLabel(task.startAt)
                  : '시간 미정';
                const expanded = openId === task.id;
                return (
                  <View key={task.id}>
                    {index > 0 ? <View className="h-px bg-border" /> : null}
                    <Pressable
                      onPress={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
                      accessibilityRole="button"
                    >
                      <TaskCheckRow
                        flat
                        title={cleanTitle}
                        meta={scheduleText}
                        status={toUiStatus(record?.result)}
                        onToggle={() => toggleQuickDone(task.id)}
                      />
                    </Pressable>
                    <View className="pb-2">
                      <HiddenTagDisclosure itemId={task.id} title={task.title} compact />
                    </View>
                    {expanded ? (
                      <View className="pb-3 pt-1">
                        <StatusPicker
                          value={toUiStatus(record?.result)}
                          onChange={(s) => choose(task.id, fromUiStatus(s))}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {!!tasks.length ? (
            <Button size="lg" disabled={!canSave} onPress={() => void save()}>
              <Text>{saving ? '저장 중' : '수행 기록 저장'}</Text>
            </Button>
          ) : null}
        </>
      ) : null}

      {!!message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-center text-sm font-semibold text-primary"
        >
          {message}
        </Text>
      ) : null}

      <Button
        variant="ghost"
        disabled={saving}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/calendar');
        }}
      >
        <Text>닫기</Text>
      </Button>
    </ScrollView>
  );
}
