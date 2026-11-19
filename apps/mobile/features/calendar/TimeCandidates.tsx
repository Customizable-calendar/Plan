import type { Card } from '@noteapp/shared';
import { BottomSheet, Button, Scrim, SlotOption, Text } from '@noteapp/ui';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import { clearTaskTimeSlot, confirmAndSaveTimeSlot, useCalendar } from './data';
import {
  busyHoursOnDay,
  dayKey,
  overlaps,
  shiftDay,
  splitTitleAndTags,
  suggestSlotsAcrossDays,
  timeLabel,
  type TimeSlot,
} from './model';
import { useResolvedCalendarTags } from './tagStore';

type RangeScope = 'today' | 'tomorrow' | 'week' | 'target';
type PickerMode = 'recommend' | 'manual';

const DURATIONS = [30, 60, 120] as const;

function formatDurationLabel(minutes: number): string {
  if (minutes === 60) return '1시간';
  if (minutes === 120) return '2시간';
  return `${minutes}분`;
}

function formatDayPill(day: string, today: string, tomorrow: string): string {
  if (day === today) return '오늘';
  if (day === tomorrow) return '내일';
  const parsed = new Date(`${day}T00:00:00+09:00`);
  const weekday = parsed.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  });
  return `${day.slice(5).replace('-', '/')} (${weekday})`;
}

export function TimeCandidates({
  task,
  day,
  onClose,
  onPressTag,
}: {
  task: Card;
  day: string;
  onClose: () => void;
  onPressTag?: (tag: string) => void;
}) {
  const { events, tasks } = useCalendar();
  const [openedAt] = useState(() => Date.now());
  const today = dayKey(new Date(openedAt));
  const tomorrow = shiftDay(today, 1);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => shiftDay(today, idx)),
    [today],
  );

  const rawTagItems = useMemo(
    () => [
      ...events.map((item) => ({ id: item.id, title: item.title })),
      ...tasks.map((item) => ({ id: item.id, title: item.title })),
    ],
    [events, tasks],
  );
  const { byId: resolvedTagById } = useResolvedCalendarTags(rawTagItems);
  const itemTagsById = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const [id, entry] of resolvedTagById.entries()) {
      map.set(id, entry.tags);
    }
    return map;
  }, [resolvedTagById]);
  const targetTags = useMemo(
    () => resolvedTagById.get(task.id)?.tags ?? [],
    [resolvedTagById, task.id],
  );

  const otherTasksAndEvents = useMemo(
    () => tasks.filter((item) => item.id !== task.id),
    [task.id, tasks],
  );

  const [durationMinutes, setDurationMinutes] = useState<number>(() => {
    if (task.startAt && task.endAt) {
      const diff = Math.round((Date.parse(task.endAt) - Date.parse(task.startAt)) / 60000);
      if (diff === 30 || diff === 60 || diff === 120) return diff;
    }
    return 60;
  });

  // 오늘 남은 시간이 전혀 없으면 처음부터 '이번 주 추천'을 펼쳐 빈 후보 화면을 피해요.
  const [scope, setScope] = useState<RangeScope>(() => {
    if (day !== today && day !== tomorrow) return 'target';
    const initialSlots = suggestSlotsAcrossDays([day], events, otherTasksAndEvents, {
      dueAt: task.dueAt,
      now: openedAt,
      durationMinutes: 60,
      excludeTaskId: task.id,
      targetTitle: task.title,
      targetTags,
      itemTagsById,
      limit: 1,
    });
    if (initialSlots.length > 0) {
      return day === tomorrow ? 'tomorrow' : 'today';
    }
    return 'week';
  });

  const [mode, setMode] = useState<PickerMode>('recommend');
  const [manualDay, setManualDay] = useState<string>(() => {
    if (scope === 'tomorrow') return tomorrow;
    if (scope === 'target') return day;
    return today;
  });
  const [selectedStartAt, setSelectedStartAt] = useState<string | undefined>();
  const [manualSlot, setManualSlot] = useState<TimeSlot | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { cleanTitle } = splitTitleAndTags(task.title);

  const targetDays = useMemo(() => {
    if (scope === 'today') return [today];
    if (scope === 'tomorrow') return [tomorrow];
    if (scope === 'target') return [day];
    return weekDays;
  }, [day, scope, today, tomorrow, weekDays]);

  const candidates = useMemo(
    () =>
      suggestSlotsAcrossDays(targetDays, events, tasks, {
        dueAt: task.dueAt,
        now: openedAt,
        durationMinutes,
        limit: scope === 'week' ? 6 : 4,
        excludeTaskId: task.id,
        targetTitle: task.title,
        targetTags,
        itemTagsById,
      }),
    [
      durationMinutes,
      events,
      itemTagsById,
      openedAt,
      scope,
      targetDays,
      targetTags,
      task.dueAt,
      task.id,
      task.title,
      tasks,
    ],
  );

  const effectiveCandidate = useMemo(() => {
    if (mode === 'manual') return manualSlot;
    return candidates.find((slot) => slot.startAt === selectedStartAt) ?? candidates[0];
  }, [candidates, manualSlot, mode, selectedStartAt]);

  // 상단 08시~21시 타임라인 막대가 보여줄 기준 날짜예요.
  const inspectDay =
    mode === 'manual'
      ? manualDay
      : (effectiveCandidate?.day ??
        (scope === 'tomorrow' ? tomorrow : scope === 'target' ? day : today));

  const hourAvailability = useMemo(
    () =>
      busyHoursOnDay(inspectDay, events, tasks, {
        startHour: 8,
        endHour: 21,
        excludeTaskId: task.id,
      }),
    [events, inspectDay, task.id, tasks],
  );

  const busyIntervals = useMemo(
    () =>
      [...events, ...otherTasksAndEvents.filter((item) => item.status !== 'dismissed')]
        .filter((item) => Boolean(item.startAt && item.endAt))
        .map((item) => ({ startAt: item.startAt!, endAt: item.endAt! })),
    [events, otherTasksAndEvents],
  );

  const buildHourSlot = (slotDay: string, hour: number): TimeSlot | undefined => {
    const midnight = Date.parse(`${slotDay}T00:00:00+09:00`);
    const fromMs = midnight + hour * 3600000;
    const toMs = fromMs + durationMinutes * 60000;
    if (fromMs < openedAt) return undefined;
    const startAt = new Date(fromMs).toISOString();
    const endAt = new Date(toMs).toISOString();
    if (busyIntervals.some((item) => overlaps(startAt, endAt, item.startAt, item.endAt))) {
      return undefined;
    }
    return {
      startAt,
      endAt,
      day: slotDay,
      fit: hour >= 9 && hour < 18 ? 'good' : 'ok',
      reason: '직접 선택한 빈 시간이에요.',
    };
  };

  const selectScope = (nextScope: RangeScope) => {
    setScope(nextScope);
    setSelectedStartAt(undefined);
    setManualSlot(undefined);
    setError('');
    if (nextScope === 'today') setManualDay(today);
    else if (nextScope === 'tomorrow') setManualDay(tomorrow);
    else if (nextScope === 'target') setManualDay(day);
  };

  const selectDuration = (nextMinutes: number) => {
    setDurationMinutes(nextMinutes);
    setSelectedStartAt(undefined);
    setManualSlot(undefined);
    setError('');
  };

  const handleSave = async () => {
    if (!effectiveCandidate || saving) return;
    setSaving(true);
    setError('');
    try {
      await confirmAndSaveTimeSlot(task.id, effectiveCandidate, { allowPastDue: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '시간을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await clearTaskTimeSlot(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '배정된 시간을 비우지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const selectedDayForBar = effectiveCandidate ? dayKey(effectiveCandidate.startAt) : undefined;
  const dueMs = task.dueAt ? Date.parse(task.dueAt) : undefined;
  const isPastDueSelection =
    Boolean(dueMs && effectiveCandidate) && Date.parse(effectiveCandidate!.endAt) > dueMs!;

  const primaryLabel = saving
    ? '저장 중'
    : effectiveCandidate
      ? `${formatDayPill(dayKey(effectiveCandidate.startAt), today, tomorrow)} ${timeLabel(effectiveCandidate.startAt)}에 넣기`
      : '시간을 먼저 골라 주세요';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="시간 잡기 창 닫기"
          disabled={saving}
          onPress={onClose}
          className="absolute inset-0"
        >
          <Scrim />
        </Pressable>
        <BottomSheet title={cleanTitle} className="max-h-[88%]">
          <ScrollView contentContainerClassName="gap-4 pb-2">
            <View className="gap-1.5">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                {task.startAt && task.endAt ? (
                  <Text className="text-xs font-semibold text-primary">
                    현재 배정: {formatDayPill(dayKey(task.startAt), today, tomorrow)}{' '}
                    {timeLabel(task.startAt)} ~ {timeLabel(task.endAt)}
                  </Text>
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    빈 시간대와 소요 시간을 고르고 한 번에 저장하세요.
                  </Text>
                )}
                <View className="rounded-md bg-task-soft px-2 py-0.5">
                  <Text className="text-[11px] font-semibold text-task">
                    {task.status === 'confirmed' ? '할 일' : '확인 대기'}
                  </Text>
                </View>
              </View>

              {task.dueAt ? (
                <Text className="text-[11px] text-muted-foreground">
                  마감 기준: {dayKey(task.dueAt).slice(5)} {timeLabel(task.dueAt)}
                </Text>
              ) : null}

              <HiddenTagDisclosure
                itemId={task.id}
                title={task.title}
                editable
                compact
                onPressTag={onPressTag}
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground">날짜와 소요 시간</Text>
              <View className="flex-row flex-wrap gap-1.5">
                <Pressable
                  onPress={() => selectScope('today')}
                  className={
                    scope === 'today'
                      ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                      : 'rounded-full border border-border bg-card px-3 py-1.5'
                  }
                >
                  <Text
                    className={
                      scope === 'today'
                        ? 'text-xs font-semibold text-primary-foreground'
                        : 'text-xs font-semibold text-foreground'
                    }
                  >
                    오늘
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => selectScope('tomorrow')}
                  className={
                    scope === 'tomorrow'
                      ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                      : 'rounded-full border border-border bg-card px-3 py-1.5'
                  }
                >
                  <Text
                    className={
                      scope === 'tomorrow'
                        ? 'text-xs font-semibold text-primary-foreground'
                        : 'text-xs font-semibold text-foreground'
                    }
                  >
                    내일
                  </Text>
                </Pressable>
                {day !== today && day !== tomorrow && (
                  <Pressable
                    onPress={() => selectScope('target')}
                    className={
                      scope === 'target'
                        ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                        : 'rounded-full border border-border bg-card px-3 py-1.5'
                    }
                  >
                    <Text
                      className={
                        scope === 'target'
                          ? 'text-xs font-semibold text-primary-foreground'
                          : 'text-xs font-semibold text-foreground'
                      }
                    >
                      {formatDayPill(day, today, tomorrow)}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => selectScope('week')}
                  className={
                    scope === 'week'
                      ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                      : 'rounded-full border border-border bg-card px-3 py-1.5'
                  }
                >
                  <Text
                    className={
                      scope === 'week'
                        ? 'text-xs font-semibold text-primary-foreground'
                        : 'text-xs font-semibold text-foreground'
                    }
                  >
                    이번 주 추천
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row items-center justify-between gap-2 pt-1">
                <View className="flex-row gap-1.5">
                  {DURATIONS.map((minutes) => {
                    const active = durationMinutes === minutes;
                    return (
                      <Pressable
                        key={minutes}
                        onPress={() => selectDuration(minutes)}
                        className={
                          active
                            ? 'rounded-lg border border-primary/50 bg-primary-soft px-3 py-1.5'
                            : 'rounded-lg border border-border bg-muted px-3 py-1.5'
                        }
                      >
                        <Text
                          className={
                            active
                              ? 'text-xs font-semibold text-primary-soft-foreground'
                              : 'text-xs font-medium text-muted-foreground'
                          }
                        >
                          {formatDurationLabel(minutes)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    setMode((prev) => (prev === 'recommend' ? 'manual' : 'recommend'));
                    setError('');
                  }}
                  className={
                    mode === 'manual'
                      ? 'rounded-lg border border-primary bg-primary-soft px-3 py-1.5'
                      : 'rounded-lg border border-border bg-background px-3 py-1.5'
                  }
                >
                  <Text
                    className={
                      mode === 'manual'
                        ? 'text-xs font-semibold text-primary-soft-foreground'
                        : 'text-xs font-semibold text-foreground'
                    }
                  >
                    {mode === 'manual' ? '추천 보기' : '직접 시간 고르기'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">
                  {formatDayPill(inspectDay, today, tomorrow)} 빈 시간 (08시 ~ 21시)
                </Text>
                <Text className="text-[11px] text-muted-foreground">
                  칸을 눌러 바로 선택할 수도 있어요
                </Text>
              </View>

              <View className="flex-row gap-1">
                {hourAvailability.map((slot) => {
                  const isSelectedHour =
                    Boolean(effectiveCandidate && selectedDayForBar === inspectDay) &&
                    (() => {
                      const midnight = Date.parse(`${inspectDay}T00:00:00+09:00`);
                      const hStart = new Date(midnight + slot.hour * 3600000).toISOString();
                      const hEnd = new Date(midnight + (slot.hour + 1) * 3600000).toISOString();
                      return overlaps(
                        hStart,
                        hEnd,
                        effectiveCandidate!.startAt,
                        effectiveCandidate!.endAt,
                      );
                    })();

                  const candidateSlot = buildHourSlot(inspectDay, slot.hour);
                  const canTap = Boolean(candidateSlot);

                  return (
                    <Pressable
                      key={slot.hour}
                      disabled={!canTap}
                      onPress={() => {
                        if (!candidateSlot) return;
                        setMode('manual');
                        setManualDay(inspectDay);
                        setManualSlot(candidateSlot);
                        setError('');
                      }}
                      className="flex-1 items-center gap-1"
                    >
                      <View
                        className={
                          isSelectedHour
                            ? 'h-6 w-full rounded border border-primary bg-primary'
                            : slot.busy
                              ? 'h-6 w-full rounded border border-secondary/35 bg-secondary-soft'
                              : canTap
                                ? 'h-6 w-full rounded border border-task/35 bg-task-soft'
                                : 'h-6 w-full rounded border border-border bg-muted'
                        }
                      />
                      <Text className="text-[10px] font-medium text-muted-foreground">
                        {String(slot.hour).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row flex-wrap items-center gap-3 pt-0.5">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-sm border border-task/40 bg-task-soft" />
                  <Text className="text-[11px] text-muted-foreground">비어 있음</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-sm border border-secondary/40 bg-secondary-soft" />
                  <Text className="text-[11px] text-muted-foreground">일정 있음</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-sm border border-primary bg-primary" />
                  <Text className="text-[11px] text-muted-foreground">선택한 시간</Text>
                </View>
              </View>
            </View>

            {mode === 'recommend' ? (
              <View className="gap-2">
                <View className="gap-1">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    추천 시간 후보
                  </Text>
                  {targetTags.length > 0 ? (
                    <Text className="text-[11px] text-muted-foreground">
                      분석 기준 태그: {targetTags.slice(0, 4).join(', ')}
                    </Text>
                  ) : null}
                </View>
                {candidates.length === 0 ? (
                  <View className="gap-2 rounded-xl border border-border bg-muted/40 p-3.5">
                    <Text className="text-sm font-semibold text-foreground">
                      선택한 날짜에 비어 있는 {formatDurationLabel(durationMinutes)} 슬롯이 없어요.
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      위에서 내일, 이번 주 추천 또는 30분 단위로 바꿔 보세요.
                    </Text>
                  </View>
                ) : (
                  <View accessibilityLabel="시간 후보 목록" className="gap-2">
                    {candidates.map((slot) => {
                      const slotDay = slot.day ?? dayKey(slot.startAt);
                      const timeText =
                        scope === 'week'
                          ? `${formatDayPill(slotDay, today, tomorrow)} ${timeLabel(slot.startAt)} ~ ${timeLabel(slot.endAt)}`
                          : `${timeLabel(slot.startAt)} ~ ${timeLabel(slot.endAt)}`;
                      const fit = slot.fit ?? 'ok';
                      const score = slot.score ?? (fit === 'good' ? 92 : fit === 'ok' ? 78 : 62);
                      return (
                        <SlotOption
                          key={slot.startAt}
                          time={timeText}
                          fit={fit}
                          score={score}
                          reason={slot.reason}
                          selected={effectiveCandidate?.startAt === slot.startAt}
                          onPress={() => {
                            setSelectedStartAt(slot.startAt);
                            setError('');
                          }}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View className="gap-2.5">
                <Text className="text-xs font-semibold text-muted-foreground">
                  날짜와 시작 시각 직접 고르기
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-1.5">
                    {weekDays.map((candidateDay) => {
                      const active = manualDay === candidateDay;
                      return (
                        <Pressable
                          key={candidateDay}
                          onPress={() => {
                            setManualDay(candidateDay);
                            setManualSlot(undefined);
                            setError('');
                          }}
                          className={
                            active
                              ? 'rounded-lg border border-primary bg-primary px-3 py-1.5'
                              : 'rounded-lg border border-border bg-card px-3 py-1.5'
                          }
                        >
                          <Text
                            className={
                              active
                                ? 'text-xs font-semibold text-primary-foreground'
                                : 'text-xs font-medium text-foreground'
                            }
                          >
                            {formatDayPill(candidateDay, today, tomorrow)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <View className="flex-row flex-wrap gap-2">
                  {hourAvailability.map((slot) => {
                    const candidateSlot = buildHourSlot(manualDay, slot.hour);
                    const isSelected =
                      manualSlot?.startAt === candidateSlot?.startAt && Boolean(candidateSlot);
                    return (
                      <Pressable
                        key={slot.hour}
                        disabled={!candidateSlot}
                        onPress={() => {
                          if (!candidateSlot) return;
                          setManualSlot(candidateSlot);
                          setError('');
                        }}
                        className={
                          isSelected
                            ? 'w-[23%] items-center rounded-lg border border-primary bg-primary py-2'
                            : candidateSlot
                              ? 'w-[23%] items-center rounded-lg border border-border bg-card py-2'
                              : 'w-[23%] items-center rounded-lg border border-border bg-muted py-2 opacity-45'
                        }
                      >
                        <Text
                          className={
                            isSelected
                              ? 'text-xs font-bold text-primary-foreground'
                              : 'text-xs font-semibold text-foreground'
                          }
                        >
                          {String(slot.hour).padStart(2, '0')}:00
                        </Text>
                        <Text
                          className={
                            isSelected
                              ? 'text-[10px] text-primary-foreground'
                              : 'text-[10px] text-muted-foreground'
                          }
                        >
                          {slot.busy ? '일정 있음' : candidateSlot ? '선택 가능' : '지남'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {isPastDueSelection ? (
              <View className="rounded-lg border border-border bg-accent px-3 py-2">
                <Text className="text-xs font-medium text-accent-foreground">
                  기존 마감 기준 이후 시간으로 배정돼요. 필요하면 그대로 저장할 수 있어요.
                </Text>
              </View>
            ) : null}

            {!!error ? (
              <Text accessibilityRole="alert" className="text-sm text-destructive">
                {error}
              </Text>
            ) : null}

            <View className="gap-2 pt-1">
              <Button
                size="lg"
                disabled={!effectiveCandidate || saving}
                onPress={() => void handleSave()}
              >
                <Text>{primaryLabel}</Text>
              </Button>
              {task.startAt ? (
                <Button variant="outline" disabled={saving} onPress={() => void handleClear()}>
                  <Text>배정된 시간 비우기</Text>
                </Button>
              ) : null}
              <Button variant="ghost" disabled={saving} onPress={onClose}>
                <Text>닫기</Text>
              </Button>
            </View>
          </ScrollView>
        </BottomSheet>
      </View>
    </Modal>
  );
}
