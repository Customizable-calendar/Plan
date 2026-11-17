import { palette } from '@noteapp/ui';
import type { CalendarEvent, Card } from '@noteapp/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirmTask, deleteCalendarEvent, saveCalendarEvent, saveTimeSlot } from './data';
import {
  dayKey,
  overlaps,
  shiftDay,
  splitTitleAndTags,
  timeLabel,
  TIMEZONE,
  type TimeSlot,
} from './model';

type SheetTab = 'events' | 'tasks' | 'add';
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
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const cls = selected
    ? 'border-primary bg-primary'
    : tone === 'danger'
      ? 'border-border bg-card'
      : 'border-border bg-card';
  const textCls = selected
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

function SheetTagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {tags.map((tag) => (
        <View key={tag} className="rounded-sm bg-muted px-2 py-0.5">
          <Text className="text-[11px] font-semibold text-muted-foreground">{tag}</Text>
        </View>
      ))}
    </View>
  );
}

export function CalendarDaySheet({
  day,
  initialHour,
  events,
  tasks,
  onChangeDay,
  onSelectTask,
  onClose,
}: {
  day: string;
  initialHour?: number;
  events: CalendarEvent[];
  tasks: Card[];
  onChangeDay: (nextDay: string) => void;
  onSelectTask: (task: Card) => void;
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
    initialHour !== undefined && dayEvents.length === 0 ? 'add' : 'events',
  );
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => initialHour ?? 9);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openedAt] = useState(() => Date.now());

  const weekday = WEEKDAY_NAMES[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  const dayHeading = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${weekday}요일)`;
  const hourChoices = useMemo(
    () => [...new Set<number>([...HOUR_CHOICES, selectedHour])].sort((a, b) => a - b),
    [selectedHour],
  );

  function buildHourSlot(hour: number, task: Card): TimeSlot | undefined {
    const startMs = Date.parse(`${day}T${pad2(hour)}:00:00+09:00`);
    const endMs = startMs + 3600000;
    if (!Number.isFinite(startMs) || startMs < openedAt) return undefined;
    if (task.dueAt && endMs > Date.parse(task.dueAt)) return undefined;
    const startAt = new Date(startMs).toISOString();
    const endAt = new Date(endMs).toISOString();
    const hasConflict = busyItems.some(
      (item) =>
        item.id !== task.id &&
        item.startAt &&
        item.endAt &&
        overlaps(startAt, endAt, item.startAt, item.endAt),
    );
    if (hasConflict) return undefined;
    return {
      startAt,
      endAt,
      reason: '선택한 시간대에 바로 배치했어요.',
    };
  }

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

  async function handleDirectAssign(task: Card, slot: TimeSlot) {
    setBusyId(task.id);
    setError('');
    setNotice('');
    try {
      await saveTimeSlot(task.id, slot);
      setNotice(`${timeLabel(slot.startAt)}에 할 일을 배치했어요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '할 일 시간을 저장하지 못했어요.');
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
      setNotice('새 일정을 저장했어요.');
      setTab('events');
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
        <View className="max-h-[88%] w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card">
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
                { key: 'events', label: `일정 (${dayEvents.length})` },
                { key: 'tasks', label: `할 일 (${dayTasks.length})` },
                { key: 'add', label: '일정 추가' },
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-3.5 p-5"
          >
            {!!notice && (
              <View className="rounded-lg bg-primary-soft px-3 py-2">
                <Text className="text-xs font-semibold text-primary-soft-foreground">
                  {notice}
                </Text>
              </View>
            )}
            {!!error && (
              <View className="rounded-lg bg-secondary-soft px-3 py-2">
                <Text accessibilityRole="alert" className="text-xs font-semibold text-destructive">
                  {error}
                </Text>
              </View>
            )}

            {tab === 'events' && (
              <View className="gap-2.5">
                {dayEvents.length === 0 ? (
                  <View className="gap-3 rounded-xl border border-border bg-background p-4">
                    <Text className="text-sm text-muted-foreground">
                      이 날 등록된 캘린더 일정이 없어요.
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <SheetButton
                        label="새 일정 추가"
                        selected
                        onPress={() => setTab('add')}
                      />
                      <SheetButton
                        label={`할 일 보기 (${unscheduled.length}개 대기)`}
                        onPress={() => setTab('tasks')}
                      />
                    </View>
                  </View>
                ) : (
                  dayEvents.map((ev) => {
                    const { cleanTitle, tags } = splitTitleAndTags(ev.title);
                    const range = ev.allDay
                      ? '종일'
                      : `${timeLabel(ev.startAt)} ~ ${timeLabel(ev.endAt)}`;
                    return (
                      <View
                        key={ev.id}
                        className="flex-row items-center gap-3 rounded-lg border-l-[3px] border-l-cal-1 bg-cal-1-soft px-3 py-2.5"
                      >
                        <Text className="w-24 text-xs font-bold text-muted-foreground">
                          {range}
                        </Text>
                        <View className="flex-1 gap-1">
                          <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                          <SheetTagChips tags={tags} />
                        </View>
                        <View className="items-end gap-1.5">
                          <View className="rounded-sm bg-card px-2 py-0.5">
                            <Text className="text-[11px] font-bold text-cal-1">캘린더</Text>
                          </View>
                          <SheetButton
                            label={busyId === ev.id ? '삭제 중' : '삭제'}
                            tone="danger"
                            disabled={busyId === ev.id}
                            onPress={() => void handleDeleteEvent(ev.id)}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {tab === 'tasks' && (
              <View className="gap-4">
                <Pressable
                  accessibilityRole="button"
                  onPress={goExecution}
                  className="items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2.5"
                >
                  <Text className="text-sm font-bold text-primary-foreground">
                    이 날 수행 확인하기
                  </Text>
                </Pressable>

                <View className="gap-2">
                  <Text className="text-sm font-bold text-foreground">
                    이 날 배정된 할 일 ({dayTasks.length}개)
                  </Text>
                  {dayTasks.length === 0 ? (
                    <Text className="text-xs text-muted-foreground">
                      이 날에 배정된 할 일이 없어요.
                    </Text>
                  ) : (
                    dayTasks.map((task) => {
                      const { cleanTitle, tags } = splitTitleAndTags(task.title);
                      const range = `${timeLabel(task.startAt!)} ~ ${timeLabel(task.endAt!)}`;
                      return (
                        <View
                          key={task.id}
                          className="flex-row items-center gap-3 rounded-lg border-l-[3px] border-l-task bg-task-soft px-3 py-2.5"
                        >
                          <Text className="w-24 text-xs font-bold text-muted-foreground">
                            {range}
                          </Text>
                          <View className="flex-1 gap-1">
                            <Text className="text-sm font-bold text-foreground">{cleanTitle}</Text>
                            <SheetTagChips tags={tags} />
                          </View>
                          <View className="items-end gap-1.5">
                            <View className="rounded-sm bg-card px-2 py-0.5">
                              <Text className="text-[11px] font-bold text-task">할 일</Text>
                            </View>
                            <SheetButton label="시간 변경" onPress={() => onSelectTask(task)} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                <View className="gap-2 border-t border-border pt-3">
                  <Text className="text-sm font-bold text-foreground">
                    미배정 할 일 이 날에 배치 ({unscheduled.length}개)
                  </Text>
                  {unscheduled.length === 0 ? (
                    <Text className="text-xs text-muted-foreground">
                      시간을 잡을 미배정 할 일이 모두 정리되었어요.
                    </Text>
                  ) : (
                    unscheduled.map((task) => {
                      const { cleanTitle, tags } = splitTitleAndTags(task.title);
                      const meta = task.dueAt
                        ? `마감 ${dayKey(task.dueAt)} ${timeLabel(task.dueAt)}`
                        : '마감 없음';
                      const directSlot =
                        task.status === 'confirmed' && initialHour !== undefined
                          ? buildHourSlot(initialHour, task)
                          : undefined;
                      const busy = busyId === task.id;
                      return (
                        <View
                          key={task.id}
                          className="gap-2 rounded-xl border border-border bg-background p-3.5"
                        >
                          <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-1 gap-1">
                              <Text className="text-sm font-bold text-foreground">
                                {cleanTitle}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {meta}, {task.status === 'confirmed' ? '확인됨' : '확인 전 제안'}
                              </Text>
                              <SheetTagChips tags={tags} />
                            </View>
                            <View className="rounded-sm bg-task-soft px-2 py-0.5">
                              <Text className="text-[11px] font-bold text-task">할 일</Text>
                            </View>
                          </View>
                          <View className="flex-row flex-wrap gap-2">
                            {task.status === 'suggested' ? (
                              <SheetButton
                                label={busy ? '확인 중' : '할 일 확인'}
                                selected
                                disabled={busy}
                                onPress={() => void handleConfirm(task.id)}
                              />
                            ) : directSlot ? (
                              <>
                                <SheetButton
                                  label={
                                    busy
                                      ? '배치 중'
                                      : `${pad2(initialHour!)}:00에 바로 배치`
                                  }
                                  selected
                                  disabled={busy}
                                  onPress={() => void handleDirectAssign(task, directSlot)}
                                />
                                <SheetButton
                                  label="추천 시간 보기"
                                  disabled={busy}
                                  onPress={() => onSelectTask(task)}
                                />
                              </>
                            ) : (
                              <SheetButton
                                label="이 날 빈 시간 잡기"
                                selected
                                disabled={busy}
                                onPress={() => onSelectTask(task)}
                              />
                            )}
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
                  <Text className="text-xs font-bold text-muted-foreground">일정 제목</Text>
                  <TextInput
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      if (error) setError('');
                    }}
                    placeholder="예: 주간 팀 미팅 #기획 #팀회의"
                    placeholderTextColor={palette.mutedForeground}
                    className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
                  />
                </View>

                <View className="flex-row gap-2">
                  <SheetButton
                    label="시간 지정"
                    selected={!allDay}
                    onPress={() => setAllDay(false)}
                  />
                  <SheetButton
                    label="종일"
                    selected={allDay}
                    onPress={() => setAllDay(true)}
                  />
                </View>

                {!allDay && (
                  <>
                    <View className="gap-1.5">
                      <Text className="text-xs font-bold text-muted-foreground">시작 시각</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {hourChoices.map((hour) => (
                          <SheetButton
                            key={hour}
                            label={`${pad2(hour)}:00`}
                            selected={selectedHour === hour}
                            onPress={() => setSelectedHour(hour)}
                          />
                        ))}
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
