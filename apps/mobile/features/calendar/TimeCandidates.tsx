import type { Card } from '@noteapp/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { saveTimeSlot, useCalendar } from './data';
import { splitTitleAndTags, suggestSlots, timeLabel } from './model';

export function TimeCandidates({
  task,
  day,
  onClose,
}: {
  task: Card;
  day: string;
  onClose: () => void;
}) {
  const { events, tasks } = useCalendar();
  const slots = suggestSlots(
    day,
    events,
    tasks.filter((item) => item.id !== task.id),
    task.dueAt,
  );
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const chosen = slots.find((slot) => slot.startAt === selected);
  const { cleanTitle, tags } = splitTitleAndTags(task.title);

  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      await saveTimeSlot(task.id, chosen);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="시간 잡기 창 닫기"
          disabled={saving}
          onPress={onClose}
          className="absolute inset-0 bg-foreground/30"
        />
        <View className="max-h-[88%] w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card">
          <ScrollView contentContainerClassName="gap-4 p-5">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">시간 잡기 ({day}, 서울 시간)</Text>
              <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
                {cleanTitle}
              </Text>
              {tags.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 pt-0.5">
                  {tags.map((tag) => (
                    <View key={tag} className="rounded-sm bg-muted px-2 py-0.5">
                      <Text className="text-xs font-semibold text-muted-foreground">{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text className="text-xs text-muted-foreground">60분씩 제안해요.</Text>
            </View>

            {slots.length > 0 ? (
              <View accessibilityLabel="시간 후보 목록" className="gap-2.5">
                {slots.map((slot, i) => {
                  const on = selected === slot.startAt;
                  return (
                    <Pressable
                      key={slot.startAt}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => {
                        setSelected(slot.startAt);
                        setError('');
                      }}
                      className={`flex-row gap-3 rounded-lg px-3.5 py-3 ${
                        on
                          ? 'border-2 border-primary bg-primary-soft/40'
                          : 'border border-border bg-background'
                      }`}
                    >
                      <View
                        className={`mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                          on ? 'border-primary' : 'border-input'
                        }`}
                      >
                        {on && <View className="h-2 w-2 rounded-full bg-primary" />}
                      </View>
                      <View className="flex-1 gap-1">
                        <Text className="text-base font-bold text-foreground">
                          {timeLabel(slot.startAt)} ~ {timeLabel(slot.endAt)}
                        </Text>
                        <Text className="text-xs font-semibold text-primary">
                          {i === 0 ? '잘 맞음' : '다른 후보'}
                        </Text>
                        <Text className="text-xs text-muted-foreground">{slot.reason}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="text-sm text-foreground">
                현재 시각과 마감, 기존 일정을 고려하면 가능한 시간이 없어요.
              </Text>
            )}

            {chosen && (
              <View className="gap-1 rounded-lg border-[1.5px] border-dashed border-ai bg-ai-soft/40 p-3.5">
                <Text className="text-sm font-bold text-ai">
                  선택한 시간 {timeLabel(chosen.startAt)} ~ {timeLabel(chosen.endAt)}
                </Text>
                <Text className="text-xs text-ai">저장 직전에 충돌을 한 번 더 확인해요.</Text>
              </View>
            )}

            {!!error && (
              <Text accessibilityRole="alert" className="text-sm text-destructive">
                {error}
              </Text>
            )}

            <View className="gap-2 pt-1">
              <Pressable
                accessibilityRole="button"
                disabled={!chosen || saving}
                onPress={() => void save()}
                className={`min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 ${
                  !chosen || saving ? 'opacity-40' : ''
                }`}
              >
                <Text className="text-sm font-bold text-primary-foreground">
                  {saving ? '저장 중' : '이 시간으로 저장'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onClose}
                className="min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5"
              >
                <Text className="text-sm font-semibold text-foreground">돌아가기</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
