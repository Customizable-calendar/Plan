import type { Card, ExecutionRecord, ExecutionResult } from '@noteapp/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarButton, dayKey, useCalendarTheme } from '@/features/calendar';

import { loadExecution, saveExecutionRecords } from './data';
import { resultLabels, resultOrder } from './model';

export function ExecutionScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const initialDay =
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date))
      ? date
      : dayKey(new Date());
  const day = initialDay;
  const [tasks, setTasks] = useState<Card[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ExecutionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const { colors, styles } = useCalendarTheme();
  useEffect(() => {
    let active = true;
    loadExecution(day)
      .then(({ tasks, records }) => {
        if (!active) return;
        setTasks(tasks);
        setDrafts(
          Object.fromEntries(
            records
              .filter((record) => tasks.some((task) => task.id === record.cardId))
              .map((record) => [record.cardId, record]),
          ),
        );
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
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
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.muted}>{day} · 수행 확인</Text>
      <Text accessibilityRole="header" style={styles.title}>
        계획한 일, 어땠나요?
      </Text>
      <Text style={styles.muted}>모름은 실패로 세지 않아요. 고른 뒤 저장해 주세요.</Text>
      {loading && (
        <ActivityIndicator accessibilityLabel="수행 기록 불러오는 중" color={colors.primary} />
      )}
      {!!error && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
          <CalendarButton
            label="다시 불러오기"
            onPress={() => {
              setLoading(true);
              setError('');
              setRetry((value) => value + 1);
            }}
          />
        </View>
      )}
      {!loading && !error && (
        <>
          {!tasks.length && (
            <View style={styles.card}>
              <Text style={styles.text}>이 날짜에는 확인할 할 일이 없어요.</Text>
              <Text style={styles.muted}>캘린더에서 할 일을 확인하고 시간을 잡아 주세요.</Text>
            </View>
          )}
          {tasks.map((task) => {
            const record = drafts[task.id];
            return (
              <View key={task.id} style={styles.card}>
                <Text style={styles.heading}>{task.title}</Text>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={`${task.title} 수행 상태`}
                  style={styles.row}
                >
                  {resultOrder.map((result) => {
                    const selected = record?.result === result;
                    const backgroundColor = !selected
                      ? colors.background
                      : result === 'done'
                        ? colors.primary
                        : result === 'partial'
                          ? colors.primarySoft
                          : result === 'not_done'
                            ? colors.secondarySoft
                            : colors.muted;
                    return (
                      <Pressable
                        key={result}
                        disabled={saving}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: saving }}
                        onPress={() => choose(task.id, result)}
                        style={{
                          minHeight: 44,
                          flexGrow: 1,
                          padding: 10,
                          borderWidth: selected ? 2 : 1,
                          borderRadius: 8,
                          borderColor: selected
                            ? result === 'not_done'
                              ? colors.secondary
                              : colors.primary
                            : colors.border,
                          backgroundColor,
                        }}
                      >
                        <Text
                          style={{
                            textAlign: 'center',
                            fontWeight: '600',
                            color:
                              selected && result === 'done'
                                ? colors.primaryForeground
                                : colors.foreground,
                          }}
                        >
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
            <>
              <CalendarButton
                label={saving ? '저장 중…' : '수행 기록 저장'}
                selected
                disabled={saving || !Object.keys(drafts).length}
                onPress={() => void save()}
              />
            </>
          )}
        </>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message}
        </Text>
      )}
      <CalendarButton
        label="닫기"
        disabled={saving}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/calendar');
        }}
      />
    </ScrollView>
  );
}
