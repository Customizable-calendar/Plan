import type { Card } from '@noteapp/shared';
import { BottomSheet, Button, Scrim, Text } from '@noteapp/ui';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

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
        <BottomSheet title={cleanTitle} className="max-h-[85%]">
          <ScrollView contentContainerClassName="gap-4 pb-2">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">시간 잡기, {day}</Text>
              {tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-1.5 pt-0.5">
                  {tags.map((tag) => (
                    <View key={tag} className="rounded-full bg-muted px-2.5 py-0.5">
                      <Text className="text-xs text-muted-foreground">{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {slots.length > 0 ? (
              <View accessibilityLabel="시간 후보 목록">
                {slots.map((slot, i) => {
                  const on = selected === slot.startAt;
                  return (
                    <View key={slot.startAt}>
                      {i > 0 ? <View className="h-px bg-border" /> : null}
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => {
                          setSelected(slot.startAt);
                          setError('');
                        }}
                        className={`flex-row items-center gap-3 py-3 ${on ? '-mx-2 rounded-lg bg-accent px-2' : ''}`}
                      >
                        <View
                          className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                            on ? 'border-primary' : 'border-input'
                          }`}
                        >
                          {on ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-base font-bold text-foreground">
                            {timeLabel(slot.startAt)} ~ {timeLabel(slot.endAt)}
                          </Text>
                          <Text className="text-xs text-muted-foreground">{slot.reason}</Text>
                        </View>
                        <Text className="text-xs font-bold text-primary">
                          {i === 0 ? '잘 맞음' : '후보'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text className="py-3 text-sm text-muted-foreground">
                현재 시각과 마감, 기존 일정을 고려하면 가능한 시간이 없어요.
              </Text>
            )}

            {!!error ? (
              <Text accessibilityRole="alert" className="text-sm text-destructive">
                {error}
              </Text>
            ) : null}

            <View className="gap-2 pt-1">
              <Button size="lg" disabled={!chosen || saving} onPress={() => void save()}>
                <Text>
                  {saving
                    ? '저장 중'
                    : chosen
                      ? `${timeLabel(chosen.startAt)}에 넣기`
                      : '시간을 골라 주세요'}
                </Text>
              </Button>
              <Button variant="ghost" disabled={saving} onPress={onClose}>
                <Text>돌아가기</Text>
              </Button>
            </View>
          </ScrollView>
        </BottomSheet>
      </View>
    </Modal>
  );
}
