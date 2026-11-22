import type { CalendarEvent, Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { HiddenTagDisclosure } from './HiddenTagDisclosure';
import { extractAutoHashtags } from './autoTags';
import {
  clearTaskTimeSlot,
  confirmAndSaveTimeSlot,
  confirmTask,
  deleteCalendarEvent,
  saveCalendarEvent,
} from './data';
import {
  busyHoursOnDay,
  dayKey,
  MAX_EVENT_TITLE_LENGTH,
  overlaps,
  shiftDay,
  splitTitleAndTags,
  suggestSlotsAcrossDays,
  timeLabel,
  TIMEZONE,
  type TimeSlot,
} from './model';
import { useResolvedCalendarTags, useTagExtractionLevel } from './tagStore';

type SheetTab = 'agenda' | 'add';
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const HOUR_CHOICES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const;
const DURATION_OPTIONS = [
  { minutes: 30, label: '30분' },
  { minutes: 60, label: '1시간' },
  { minutes: 120, label: '2시간' },
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function SheetButton({
  label,
  selected = false,
  disabled = false,
  tone = 'default',
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'primary';
  onPress: () => void;
}) {
  const cls =
    selected || tone === 'primary' ? 'border-primary bg-primary' : 'border-border bg-card';
  const textCls =
    selected || tone === 'primary'
      ? 'text-primary-foreground'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 ${cls} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-xs font-semibold ${textCls}`}>{label}</Text>
    </Pressable>
  );
}

export function CalendarDaySheet({
  day,
  initialHour,
  events,
  tasks,
  onChangeDay,
  onSelectTask,
  onPressTag,
  onClose,
}: {
  day: string;
  initialHour?: number;
  events: CalendarEvent[];
  tasks: Card[];
  onChangeDay: (nextDay: string) => void;
  onSelectTask: (task: Card) => void;
  onPressTag?: (tag: string) => void;
  onClose: () => void;
}) {
  const dayEvents = events;
  const { dayTasks, unscheduled, busyItems } = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'dismissed');
    return {
      dayTasks: active.filter((t) => t.startAt && dayKey(t.startAt) === day),
      unscheduled: active.filter((t) => !t.startAt),
      busyItems: [...events, ...active],
    };
  }, [day, events, tasks]);

  const [tab, setTab] = useState<SheetTab>(() =>
    initialHour !== undefined && unscheduled.length === 0 ? 'add' : 'agenda',
  );
  const [title, setTitle] = useState('');
  const [previewTagsOpen, setPreviewTagsOpen] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => initialHour ?? 9);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openedAt] = useState(() => Date.now());

  const weekday = WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  const dayHeading = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${weekday}요일)`;

  const timelineHours = useMemo(
    () => busyHoursOnDay(day, events, tasks, { startHour: 8, endHour: 21 }),
    [day, events, tasks],
  );
  const addHourBusySet = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const h of busyHoursOnDay(day, events, tasks, { startHour: 7, endHour: 21 })) {
      map.set(h.hour, h.busy);
    }
    return map;
  }, [day, events, tasks]);

  const hourChoices = useMemo(
    () => [...new Set<number>([...HOUR_CHOICES, selectedHour])].sort((a, b) => a - b),
    [selectedHour],
  );

  // 타임라인 빈 시간 칸을 눌렀을 때 1시간 빠른 배정이 가능한지 미리 계산해요.
  const quickHourSlot = useMemo<TimeSlot | undefined>(() => {
    if (initialHour === undefined) return undefined;
    const startMs = Date.parse(`${day}T${pad2(initialHour)}:00:00+09:00`);
    const endMs = startMs + 3600000;
    if (!Number.isFinite(startMs) || startMs < openedAt) return undefined;
    const startAt = new Date(startMs).toISOString();
    const endAt = new Date(endMs).toISOString();
    const hasConflict = busyItems.some(
      (item) => item.startAt && item.endAt && overlaps(startAt, endAt, item.startAt, item.endAt),
    );
    if (hasConflict) return undefined;
    return {
      startAt,
      endAt,
      day,
      fit: 'good',
      reason: '선택한 빈 시간에 바로 배정했어요.',
    };
  }, [busyItems, day, initialHour, openedAt]);

  const timelineItems = useMemo(() => {
    const entries = [
      ...dayEvents.map((ev) => ({
        key: `event:${ev.id}`,
        kind: 'event' as const,
        sortAt: ev.allDay ? '0000' : ev.startAt,
        event: ev,
      })),
      ...dayTasks.map((task) => ({
        key: `task:${task.id}`,
        kind: 'task' as const,
        sortAt: task.startAt ?? '',
        task,
      })),
    ];
    return entries.sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  }, [dayEvents, dayTasks]);

  const [tagLevel] = useTagExtractionLevel();
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

  const autoPreviewTags = useMemo(
    () => (title.trim().length > 0 ? extractAutoHashtags(title, { level: tagLevel }) : []),
    [tagLevel, title],
  );

  const addEventRecommendations = useMemo(() => {
    if (allDay || title.trim().length < 2) return [];
    const dayStartMs = Date.parse(`${day}T00:00:00+09:00`);
    const scanStart = Number.isFinite(dayStartMs) ? Math.min(openedAt, dayStartMs) : openedAt;
    return suggestSlotsAcrossDays([day], events, tasks, {
      targetTitle: title,
      targetTags: autoPreviewTags,
      itemTagsById,
      durationMinutes,
      limit: 3,
      now: scanStart,
    });
  }, [allDay, autoPreviewTags, day, durationMinutes, events, itemTagsById, openedAt, tasks, title]);

  async function handleConfirm(taskId: string) {
    setBusyId(taskId);
    setError('');
    setNotice('');
    try {
      await confirmTask(taskId);
      setNotice('할 일을 확인했어요. 이제 시간을 잡을 수 있어요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '할 일을 확인하지 못했어요.');
    } finally {
      setBusyId('');
    }
  }

  async function handleQuickAssign(task: Card, slot: TimeSlot) {
    setBusyId(task.id);
    setError('');
    setNotice('');
    try {
      await confirmAndSaveTimeSlot(task.id, slot, { allowPastDue: true });
      setNotice(`${timeLabel(slot.startAt)}에 할 일을 바로 배정했어요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '할 일 시간을 저장하지 못했어요.');
    } finally {
      setBusyId('');
    }
  }

  async function handleClearTaskSlot(taskId: string) {
    setBusyId(taskId);
    setError('');
    setNotice('');
    try {
      await clearTaskTimeSlot(taskId);
      setNotice('배정된 시간을 비웠어요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '배정된 시간을 비우지 못했어요.');
    } finally {
      setBusyId('');
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setBusyId(eventId);
    setError('');
    setNotice('');
    try {
      await deleteCalendarEvent(eventId);
      setNotice('일정을 삭제했어요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 삭제하지 못했어요.');
    } finally {
      setBusyId('');
    }
  }

  async function handleAddEvent() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('일정 제목을 입력해 주세요.');
      return;
    }
    if (trimmed.length > MAX_EVENT_TITLE_LENGTH) {
      setError(`일정 제목은 ${MAX_EVENT_TITLE_LENGTH}자 이하로 입력해 주세요.`);
      return;
    }
    setBusyId('add-event');
    setError('');
    setNotice('');
    try {
      const startAt = allDay
        ? new Date(`${day}T00:00:00+09:00`).toISOString()
        : new Date(`${day}T${pad2(selectedHour)}:00:00+09:00`).toISOString();
      const endAt = allDay
        ? new Date(`${shiftDay(day, 1)}T00:00:00+09:00`).toISOString()
        : new Date(Date.parse(startAt) + durationMinutes * 60000).toISOString();
      await saveCalendarEvent({
        id: `local-${Date.now()}`,
        calendarId: '내 캘린더',
        title: trimmed,
        startAt,
        endAt,
        allDay,
        timezone: TIMEZONE,
        source: 'google',
      });
      setTitle('');
      setPreviewTagsOpen(false);
      setNotice('새 일정을 저장했어요.');
      setTab('agenda');
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 저장하지 못했어요.');
    } finally {
      setBusyId('');
    }
  }

  function goExecution() {
    onClose();
    router.push({ pathname: '/execution', params: { date: day } });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="날짜 상세 시트 닫기"
          onPress={onClose}
          className="absolute inset-0 bg-foreground/30"
        />
        <View className="max-h-[90%] w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card">
          <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <View className="gap-0.5">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {dayHeading}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {initialHour !== undefined
                  ? `선택한 시간 ${pad2(initialHour)}:00`
                  : `일정 ${dayEvents.length}개, 할 일 ${dayTasks.length}개`}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <SheetButton label="이전 날" onPress={() => onChangeDay(shiftDay(day, -1))} />
              <SheetButton label="다음 날" onPress={() => onChangeDay(shiftDay(day, 1))} />
              <SheetButton label="닫기" onPress={onClose} />
            </View>
          </View>

          <View className="flex-row gap-1 border-b border-border bg-muted px-5 py-2">
            {(
              [
                { key: 'agenda', label: `일정과 할 일 (${dayEvents.length + dayTasks.length})` },
                { key: 'add', label: '새 일정 추가' },
              ] as const
            ).map((item) => {
              const active = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setTab(item.key);
                    setError('');
                    setNotice('');
                  }}
                  className={`flex-1 items-center rounded-md py-2 ${active ? 'bg-background' : ''}`}
                >
                  <Text
                    className={`text-xs ${active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerClassName="gap-4 p-5">
            {!!error && (
              <View className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5">
                <Text accessibilityRole="alert" className="text-xs font-semibold text-destructive">
                  {error}
                </Text>
              </View>
            )}
            {!!notice && (
              <View className="rounded-lg border border-task/40 bg-task-soft px-3.5 py-2.5">
                <Text className="text-xs font-semibold text-task">{notice}</Text>
              </View>
            )}

            {tab === 'agenda' && (
              <View className="gap-4">
                {initialHour !== undefined && (
                  <View className="gap-2.5 rounded-xl border border-primary/30 bg-primary-soft/60 p-3.5">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-primary-soft-foreground">
                          {pad2(initialHour)}:00{' '}
                          {quickHourSlot ? '빈 시간 빠른 배정' : '선택한 시간대'}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {quickHourSlot
                            ? '할 일을 바로 끼워 넣거나 새 일정을 추가할 수 있어요.'
                            : '이미 지나갔거나 다른 일정과 겹치는 시간대예요.'}
                        </Text>
                      </View>
                      <SheetButton
                        label={`${pad2(initialHour)}:00 새 일정 추가`}
                        tone="primary"
                        onPress={() => {
                          setSelectedHour(initialHour);
                          setAllDay(false);
                          setTab('add');
                        }}
                      />
                    </View>

                    {quickHourSlot && unscheduled.length > 0 && (
                      <View className="gap-1.5">
                        {unscheduled.slice(0, 3).map((task) => {
                          const { cleanTitle } = splitTitleAndTags(task.title);
                          const isBusy = busyId === task.id;
                          return (
                            <View
                              key={task.id}
                              className="flex-row items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <Text
                                numberOfLines={1}
                                className="flex-1 text-xs font-semibold text-foreground"
                              >
                                {cleanTitle}
                              </Text>
                              <SheetButton
                                label={isBusy ? '배정 중' : '바로 배정'}
                                disabled={isBusy}
                                onPress={() => void handleQuickAssign(task, quickHourSlot)}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                <View className="gap-2 rounded-xl border border-border bg-muted/40 p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-foreground">
                      시간대 한눈에 보기 (08시 ~ 21시)
                    </Text>
                    <Text className="text-[11px] text-muted-foreground">
                      빈 칸 누르면 일정 추가
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    {timelineHours.map((slot) => {
                      const highlighted = initialHour === slot.hour;
                      return (
                        <Pressable
                          key={slot.hour}
                          onPress={() => {
                            setSelectedHour(slot.hour);
                            setAllDay(false);
                            setTab('add');
                          }}
                          className="flex-1 items-center gap-1"
                        >
                          <View
                            className={`h-5 w-full rounded border ${
                              highlighted
                                ? 'border-primary bg-primary'
                                : slot.busy
                                  ? 'border-secondary/35 bg-secondary-soft'
                                  : 'border-task/35 bg-task-soft'
                            }`}
                          />
                          <Text className="text-[10px] font-medium text-muted-foreground">
                            {String(slot.hour).padStart(2, '0')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-muted-foreground">
                      오늘 일정 및 배정된 할 일
                    </Text>
                    <Pressable onPress={() => setTab('add')}>
                      <Text className="text-xs font-semibold text-primary">새 일정 추가</Text>
                    </Pressable>
                  </View>

                  {timelineItems.length === 0 ? (
                    <View className="gap-2 rounded-xl border border-border bg-muted/40 p-3.5">
                      <Text className="text-sm font-semibold text-foreground">
                        이 날은 아직 비어 있어요.
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        새 일정을 추가하거나 아래 할 일에서 시간을 바로 잡아 보세요.
                      </Text>
                    </View>
                  ) : (
                    timelineItems.map((entry) => {
                      if (entry.kind === 'event') {
                        const ev = entry.event;
                        const { cleanTitle } = splitTitleAndTags(ev.title);
                        const canDelete = !ev.id.startsWith('card-event:');
                        return (
                          <View
                            key={entry.key}
                            className="gap-1.5 rounded-xl border border-border border-l-4 border-l-cal-1 bg-background p-3.5"
                          >
                            <View className="flex-row items-center justify-between gap-2">
                              <Text className="text-xs font-bold text-cal-1">
                                {ev.allDay
                                  ? '종일'
                                  : `${timeLabel(ev.startAt)} ~ ${timeLabel(ev.endAt)}`}
                              </Text>
                              <View className="flex-row items-center gap-2">
                                <View className="rounded-sm bg-cal-1-soft px-2 py-0.5">
                                  <Text className="text-[11px] font-semibold text-cal-1">
                                    {ev.calendarId || '캘린더'}
                                  </Text>
                                </View>
                                {canDelete && (
                                  <Pressable
                                    disabled={busyId === ev.id}
                                    onPress={() => void handleDeleteEvent(ev.id)}
                                  >
                                    <Text className="text-xs font-semibold text-destructive">
                                      삭제
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>
                            <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                            <HiddenTagDisclosure
                              itemId={ev.id}
                              title={ev.title}
                              editable
                              compact
                              onPressTag={onPressTag}
                            />
                          </View>
                        );
                      }

                      const task = entry.task;
                      const { cleanTitle } = splitTitleAndTags(task.title);
                      const isBusy = busyId === task.id;
                      return (
                        <View
                          key={entry.key}
                          className="gap-2 rounded-xl border border-border border-l-4 border-l-task bg-task-soft/45 p-3.5"
                        >
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className="text-xs font-bold text-task">
                              {task.startAt && task.endAt
                                ? `${timeLabel(task.startAt)} ~ ${timeLabel(task.endAt)}`
                                : '시간 미정'}
                            </Text>
                            <View className="rounded-sm bg-task-soft px-2 py-0.5">
                              <Text className="text-[11px] font-semibold text-task">할 일</Text>
                            </View>
                          </View>
                          <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                          <HiddenTagDisclosure
                            itemId={task.id}
                            title={task.title}
                            editable
                            compact
                            onPressTag={onPressTag}
                          />
                          <View className="flex-row flex-wrap gap-2 pt-0.5">
                            <SheetButton
                              label="시간 변경"
                              disabled={isBusy}
                              onPress={() => onSelectTask(task)}
                            />
                            <SheetButton
                              label="비우기"
                              disabled={isBusy}
                              onPress={() => void handleClearTaskSlot(task.id)}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-muted-foreground">
                      시간 안 잡은 할 일 ({unscheduled.length}개)
                    </Text>
                    <SheetButton label="수행 기록 열기" onPress={goExecution} />
                  </View>

                  {unscheduled.length === 0 ? (
                    <Text className="text-xs text-muted-foreground">
                      모든 할 일에 시간이 잡혀 있어요.
                    </Text>
                  ) : (
                    unscheduled.map((task) => {
                      const { cleanTitle } = splitTitleAndTags(task.title);
                      const isBusy = busyId === task.id;
                      const dueText = task.dueAt
                        ? `마감 ${dayKey(task.dueAt).slice(5)} ${timeLabel(task.dueAt)}`
                        : undefined;
                      return (
                        <View
                          key={task.id}
                          className="gap-2 rounded-xl border border-border bg-background p-3.5"
                        >
                          <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-1 gap-0.5">
                              <Text className="text-sm font-bold text-foreground">
                                {cleanTitle}
                              </Text>
                              {dueText ? (
                                <Text className="text-[11px] text-muted-foreground">{dueText}</Text>
                              ) : null}
                            </View>
                            <View className="rounded-sm bg-muted px-2 py-0.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">
                                {task.status === 'confirmed' ? '미배정' : '확인 대기'}
                              </Text>
                            </View>
                          </View>

                          <HiddenTagDisclosure
                            itemId={task.id}
                            title={task.title}
                            editable
                            compact
                            onPressTag={onPressTag}
                          />

                          <View className="flex-row flex-wrap gap-2 pt-0.5">
                            {task.status === 'suggested' && (
                              <SheetButton
                                label={isBusy ? '확인 중' : '확인'}
                                disabled={isBusy}
                                onPress={() => void handleConfirm(task.id)}
                              />
                            )}
                            <SheetButton
                              label="시간 잡기"
                              tone="primary"
                              disabled={isBusy}
                              onPress={() => onSelectTask(task)}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {tab === 'add' && (
              <View className="gap-3.5">
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-muted-foreground">일정 제목</Text>
                    {title.length >= 160 && (
                      <Text className="text-[11px] text-muted-foreground">
                        {title.length}/{MAX_EVENT_TITLE_LENGTH}
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={title}
                    maxLength={MAX_EVENT_TITLE_LENGTH}
                    onChangeText={(text) => {
                      setTitle(text);
                      if (error) setError('');
                    }}
                    placeholder="예: 주간 백엔드 API 명세 회의"
                    className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  {title.trim().length > 0 && (
                    <View className="gap-1.5 pt-1">
                      <Pressable
                        onPress={() => setPreviewTagsOpen((prev) => !prev)}
                        className="self-start rounded-full border border-border bg-muted px-2.5 py-1"
                      >
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          {previewTagsOpen
                            ? '자동 추출 태그 닫기'
                            : `자동 추출 태그 ${autoPreviewTags.length}개 미리보기`}
                        </Text>
                      </Pressable>
                      {previewTagsOpen && (
                        <View className="flex-row flex-wrap gap-1.5 rounded-lg border border-border bg-muted/50 p-2.5">
                          {autoPreviewTags.length > 0 ? (
                            autoPreviewTags.map((tag) => (
                              <View
                                key={tag}
                                className="rounded-full border border-primary/25 bg-primary-soft px-2.5 py-1"
                              >
                                <Text className="text-[11px] font-semibold text-primary-soft-foreground">
                                  {tag}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text className="text-xs text-muted-foreground">
                              제목을 조금 더 자세히 입력하면 태그를 추천해 드려요.
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View className="flex-row gap-2">
                  <SheetButton
                    label="시간 지정"
                    selected={!allDay}
                    onPress={() => setAllDay(false)}
                  />
                  <SheetButton label="종일" selected={allDay} onPress={() => setAllDay(true)} />
                </View>

                {!allDay && (
                  <>
                    {addEventRecommendations.length > 0 && (
                      <View className="gap-1.5 rounded-xl border border-primary/25 bg-primary-soft/50 p-3">
                        <Text className="text-xs font-bold text-primary-soft-foreground">
                          해시태그 맥락 기반 맞춤 시간 추천
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {addEventRecommendations.map((slot) => {
                            const startLabel = timeLabel(slot.startAt);
                            const recHour = Number(startLabel.slice(0, 2));
                            const selected = Number.isFinite(recHour) && selectedHour === recHour;
                            return (
                              <SheetButton
                                key={slot.startAt}
                                label={`${startLabel} 추천`}
                                selected={selected}
                                onPress={() => {
                                  if (Number.isFinite(recHour)) {
                                    setSelectedHour(recHour);
                                  }
                                }}
                              />
                            );
                          })}
                        </View>
                        <Text className="text-[11px] text-muted-foreground">
                          {addEventRecommendations[0].reason}
                        </Text>
                      </View>
                    )}

                    <View className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-muted-foreground">시작 시각</Text>
                        <Text className="text-[11px] text-muted-foreground">
                          * 표시 시간은 기존 일정과 겹칠 수 있어요
                        </Text>
                      </View>
                      <View className="flex-row flex-wrap gap-1.5">
                        {hourChoices.map((hour) => {
                          const isBusyHour = addHourBusySet.get(hour) ?? false;
                          const label = isBusyHour ? `${pad2(hour)}:00 *` : `${pad2(hour)}:00`;
                          return (
                            <SheetButton
                              key={hour}
                              label={label}
                              selected={selectedHour === hour}
                              onPress={() => setSelectedHour(hour)}
                            />
                          );
                        })}
                      </View>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-xs font-bold text-muted-foreground">소요 시간</Text>
                      <View className="flex-row gap-2">
                        {DURATION_OPTIONS.map((opt) => (
                          <SheetButton
                            key={opt.minutes}
                            label={opt.label}
                            selected={durationMinutes === opt.minutes}
                            onPress={() => setDurationMinutes(opt.minutes)}
                          />
                        ))}
                      </View>
                    </View>
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={busyId === 'add-event'}
                  onPress={() => void handleAddEvent()}
                  className={`min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 ${busyId === 'add-event' ? 'opacity-40' : ''}`}
                >
                  <Text className="text-sm font-bold text-primary-foreground">
                    {busyId === 'add-event' ? '저장 중' : '일정 저장'}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
