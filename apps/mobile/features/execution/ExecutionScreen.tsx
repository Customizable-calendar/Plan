import type { Card, ExecutionRecord, ExecutionResult } from '@noteapp/shared';
import {
  Button,
  CompletionBar,
  StatusPicker,
  TaskCheckRow,
  Text,
  cn,
  type Status,
} from '@noteapp/ui';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { dayKey, HiddenTagDisclosure, splitTitleAndTags, timeLabel } from '@/features/calendar';

import { loadExecution, onExecutionAccountChange, saveExecutionRecords } from './data';

const toUiStatus = (r?: ExecutionResult): Status | undefined => (r === 'not_done' ? 'missed' : r);

const fromUiStatus = (s: Status): ExecutionResult => (s === 'missed' ? 'not_done' : s);

// 수행 확인 시트. 디자인 시스템 개편안(동그라미 한 번으로 완료, 줄을 누르면 4가지 펼치기, 진행 줄)을 따라요.
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
  const requestIdRef = useRef(0);
  const loadedDayRef = useRef<string | null>(null);

  const fetchExecution = useCallback(
    (options?: { showSpinner?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (options?.showSpinner || loadedDayRef.current !== day) {
        setLoading(true);
      }
      loadExecution(day)
        .then(({ tasks: loadedTasks, records }) => {
          if (requestIdRef.current !== requestId) return;
          const taskIds = new Set(loadedTasks.map((task) => task.id));
          const nextDrafts: Record<string, ExecutionRecord> = {};
          for (const record of records) {
            if (taskIds.has(record.cardId) && !nextDrafts[record.cardId]) {
              nextDrafts[record.cardId] = record;
            }
          }
          loadedDayRef.current = day;
          setError('');
          setTasks(loadedTasks);
          setDrafts(nextDrafts);
        })
        .catch((err: Error) => {
          if (requestIdRef.current === requestId) setError(err.message);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoading(false);
        });
    },
    [day],
  );

  useEffect(() => {
    return onExecutionAccountChange(() => {
      loadedDayRef.current = null;
      setError('');
      fetchExecution({ showSpinner: true });
    });
  }, [fetchExecution]);

  useFocusEffect(
    useCallback(() => {
      fetchExecution();
      return () => {
        requestIdRef.current += 1;
      };
    }, [fetchExecution]),
  );

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
    setOpenId(null);
  }

  function completeRemaining() {
    setMessage('');
    const nowIso = new Date().toISOString();
    setDrafts((previous) => {
      const next = { ...previous };
      for (const task of tasks) {
        if (!next[task.id]?.result) {
          next[task.id] = {
            id: `exec-${task.id}`,
            cardId: task.id,
            result: 'done',
            recordedAt: nowIso,
          };
        }
      }
      return next;
    });
    setOpenId(null);
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

  const answeredCount = tasks.filter((t) => Boolean(drafts[t.id]?.result)).length;
  const allAnswered = tasks.length > 0 && answeredCount === tasks.length;
  const canSave = !saving && answeredCount > 0;
  const doneCount = tasks.filter((t) => drafts[t.id]?.result === 'done').length;
  const partialCount = tasks.filter((t) => drafts[t.id]?.result === 'partial').length;
  const missedCount = tasks.filter((t) => drafts[t.id]?.result === 'not_done').length;

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="mx-auto w-full max-w-[960px] gap-4 p-5 pb-12"
    >
      <View className="flex-row items-end justify-between gap-2">
        <View className="gap-0.5">
          <Text className="text-xs text-muted-foreground">{day} 수행 확인</Text>
          <Text
            accessibilityRole="header"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            오늘 한 일 확인
          </Text>
        </View>
        {tasks.length > 0 ? (
          allAnswered ? (
            <Text className="text-[13px] font-bold text-primary">{doneCount}개 끝냄</Text>
          ) : (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={completeRemaining}>
              <Text className="text-[13px] font-bold text-primary">
                남은 {tasks.length - answeredCount}개 모두 완료
              </Text>
            </Pressable>
          )
        ) : null}
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
              setError('');
              fetchExecution({ showSpinner: true });
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
                  <View key={task.id} className={cn(index > 0 && 'border-t border-border')}>
                    <TaskCheckRow
                      flat
                      title={cleanTitle}
                      meta={scheduleText}
                      status={toUiStatus(record?.result)}
                      onToggle={() => toggleQuickDone(task.id)}
                      onPress={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
                    />
                    <View className="pb-2 pl-9">
                      <HiddenTagDisclosure itemId={task.id} title={task.title} compact />
                    </View>
                    {expanded ? (
                      <View className="pb-3 pl-9 pt-1">
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

          {!!message ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center text-sm font-semibold text-primary"
            >
              {message}
            </Text>
          ) : null}

          <View className="flex-row items-center justify-between border-t border-border pt-3">
            <Button
              variant="ghost"
              disabled={saving}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/calendar');
              }}
            >
              <Text>나중에</Text>
            </Button>
            {tasks.length > 0 ? (
              <Button size="lg" disabled={!canSave} onPress={() => void save()}>
                <Text>
                  {saving ? '저장 중' : allAnswered ? '저장' : `${answeredCount}개만 저장`}
                </Text>
              </Button>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
