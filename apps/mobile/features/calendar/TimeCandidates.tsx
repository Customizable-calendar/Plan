import type { Card } from '@noteapp/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveTimeSlot, useCalendar } from './data';
import { CalendarButton, useCalendarTheme } from './design';
import { suggestSlots, timeLabel } from './model';

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
  const { colors, styles } = useCalendarTheme();
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
  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      await saveTimeSlot(task.id, chosen);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.muted}>시간 잡기 · {day} · 서울 시간</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {task.title}
          </Text>
          <Text style={styles.text}>어느 시간이 좋을까요?</Text>
          <Text style={styles.muted}>각 60분 · 선택 후 저장해야 반영돼요.</Text>
          {slots.map((slot, i) => (
            <Pressable
              key={slot.startAt}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === slot.startAt }}
              onPress={() => {
                setSelected(slot.startAt);
                setError('');
              }}
              style={[
                styles.card,
                {
                  borderColor: selected === slot.startAt ? colors.primary : colors.border,
                  borderWidth: selected === slot.startAt ? 2 : 1,
                  backgroundColor: selected === slot.startAt ? colors.primarySoft : colors.card,
                },
              ]}
            >
              <Text style={styles.heading}>
                {selected === slot.startAt ? '●' : '○'} {timeLabel(slot.startAt)}–
                {timeLabel(slot.endAt)}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {i === 0 ? '잘 맞음' : '다른 후보'}
              </Text>
              <Text style={styles.muted}>{slot.reason}</Text>
            </Pressable>
          ))}
          {slots.length < 3 && (
            <Text style={styles.text}>
              {slots.length === 0
                ? '마감과 일정을 고려하면 이 날짜에는 빈 시간이 없어요. 다른 날짜를 골라 주세요.'
                : '마감과 일정을 고려해 가능한 후보만 표시했어요.'}
            </Text>
          )}
          {chosen && (
            <View
              style={[
                styles.card,
                { borderStyle: 'dashed', borderColor: colors.ai, backgroundColor: colors.aiSoft },
              ]}
            >
              <Text style={styles.text}>
                선택한 후보 · {timeLabel(chosen.startAt)}–{timeLabel(chosen.endAt)}
              </Text>
              <Text style={styles.muted}>아직 저장되지 않았어요.</Text>
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          )}
          <CalendarButton
            label={saving ? '저장 중…' : '이 시간으로 저장'}
            selected
            disabled={!chosen || saving}
            onPress={() => void save()}
          />
          <CalendarButton label="취소" disabled={saving} onPress={onClose} />
          <Text style={styles.muted}>
            앱 실행 중에만 유지돼요. Google 캘린더에는 전송하지 않아요.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
