import type { NoteReminder } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { formatReminder, isEmail, makeReminder } from './format';

// 기록의 메모를 꾹 누르면 나오는 메뉴와 팝업들이에요. 아직 실제 알림·공유는 하지 않아요(M1).

/** 아래에서 올라오는 공용 팝업 틀. 바깥(어두운 곳)을 누르면 닫혀요. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    // Modal: 화면 위에 겹쳐 뜨는 창이에요. transparent면 뒤 화면이 비쳐 보여요.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-foreground/30" onPress={onClose} accessibilityLabel="닫기" />
      <View className="gap-2 rounded-t-xl bg-popover p-4 pb-8">
        <Text className="text-base font-bold text-popover-foreground">{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

export function Option({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-md px-2 py-3 active:bg-muted"
    >
      <Text className="text-base text-foreground">{label}</Text>
      {sub ? <Text className="text-[13px] text-muted-foreground">{sub}</Text> : null}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        selected ? 'border-primary bg-primary' : 'border-border'
      }`}
    >
      <Text
        className={`text-[13px] ${selected ? 'font-bold text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// 1. 리마인드 ----------------------------------------------------------------

const DAYS = [
  { label: '오늘', offset: 0 },
  { label: '내일', offset: 1 },
  { label: '모레', offset: 2 },
];
const HOURS = [9, 12, 15, 18, 21];

export function ReminderSheet({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current?: NoteReminder;
  onPick: (reminder: NoteReminder | undefined) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(18);

  const pick = (r: NoteReminder | undefined) => {
    onPick(r);
    setCustom(false);
    onClose();
  };

  return (
    <Sheet visible={visible} title="리마인드" onClose={onClose}>
      {current ? (
        <Text className="text-[13px] text-muted-foreground">지금: {formatReminder(current)}</Text>
      ) : null}
      {custom ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {DAYS.map((d) => (
              <Chip
                key={d.label}
                label={d.label}
                selected={day === d.offset}
                onPress={() => setDay(d.offset)}
              />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {HOURS.map((h) => (
              <Chip key={h} label={`${h}시`} selected={hour === h} onPress={() => setHour(h)} />
            ))}
          </View>
          <Option label="이 시간으로 정하기" onPress={() => pick(makeReminder(day, hour))} />
        </View>
      ) : (
        <>
          <Option label="오늘 오후" sub="오후 6:00" onPress={() => pick(makeReminder(0, 18))} />
          <Option label="내일 오전" sub="오전 9:00" onPress={() => pick(makeReminder(1, 9))} />
          <Option label="직접 선택" sub="날짜와 시간 고르기" onPress={() => setCustom(true)} />
          {current ? <Option label="리마인드 지우기" onPress={() => pick(undefined)} /> : null}
        </>
      )}
    </Sheet>
  );
}

// 2. 공동 작업자 --------------------------------------------------------------

export function CollaboratorSheet({
  visible,
  emails,
  onChange,
  onClose,
}: {
  visible: boolean;
  emails: string[];
  onChange: (emails: string[]) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const email = input.trim().toLowerCase();
    if (!isEmail(email)) return setError('이메일 모양이 아니에요.');
    if (emails.includes(email)) return setError('이미 추가한 사람이에요.');
    onChange([...emails, email]);
    setInput('');
    setError(null);
  };

  return (
    <Sheet visible={visible} title="공동 작업자" onClose={onClose}>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={add}
          placeholder="이메일 입력"
          placeholderTextColor={palette.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="공동 작업자 이메일"
          className="h-10 flex-1 rounded-md border border-input px-2 text-base text-foreground"
        />
        <Chip label="추가" selected onPress={add} />
      </View>
      {error ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
      {emails.map((e) => (
        <View key={e} className="flex-row items-center gap-2">
          <Avatar email={e} />
          <Text className="flex-1 text-base text-foreground">{e}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${e} 빼기`}
            onPress={() => onChange(emails.filter((x) => x !== e))}
          >
            <Text className="text-[13px] text-muted-foreground">빼기</Text>
          </Pressable>
        </View>
      ))}
      <Text className="text-[13px] text-muted-foreground">
        아직 실제로 공유되지는 않아요. (M1 가짜 화면)
      </Text>
      <Option label="완료" onPress={onClose} />
    </Sheet>
  );
}

const AVATAR_SIZE = { sm: 'h-5 w-5', md: 'h-7 w-7' };

/** 이메일 첫 글자로 만든 동그란 프로필 */
export function Avatar({ email, size = 'md' }: { email: string; size?: 'sm' | 'md' }) {
  return (
    <View
      className={`${AVATAR_SIZE[size]} items-center justify-center rounded-full border border-card bg-person-soft`}
    >
      <Text className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} font-bold text-person`}>
        {email[0]?.toUpperCase()}
      </Text>
    </View>
  );
}

// 4. 해시태그 ----------------------------------------------------------------

const SUGGESTED_TAGS = ['#업무일지', '#회의록', '#아이디어', '#할일', '#학습일지'];

export function HashtagSheet({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (tag: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pick = (tag: string) => {
    onPick(tag);
    setInput('');
    setError(null);
    onClose();
  };

  // 직접 쓴 태그: 앞의 #과 띄어쓰기는 정리하고, 맨 앞에 #을 하나 붙여요.
  const addTyped = () => {
    const word = input.trim().replace(/^#+/, '').replace(/\s+/g, '_');
    if (!word) return setError('태그를 입력해 주세요.');
    pick(`#${word}`);
  };

  return (
    <Sheet visible={visible} title="해시태그" onClose={onClose}>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addTyped}
          placeholder="#태그 직접 입력"
          placeholderTextColor={palette.mutedForeground}
          autoCapitalize="none"
          accessibilityLabel="해시태그 직접 입력"
          className="h-10 flex-1 rounded-md border border-input px-2 text-base text-foreground"
        />
        <Chip label="붙이기" selected onPress={addTyped} />
      </View>
      {error ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
      <Text className="text-[13px] text-muted-foreground">추천 태그</Text>
      <View className="flex-row flex-wrap gap-2">
        {SUGGESTED_TAGS.map((tag) => (
          <Chip key={tag} label={tag} onPress={() => pick(tag)} />
        ))}
      </View>
    </Sheet>
  );
}

// 배지 ----------------------------------------------------------------------

/** 종 아이콘 + 알림 시각 배지 (기록 말풍선이 써요) */
export function ReminderBadge({ reminder }: { reminder: NoteReminder }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5">
      <SymbolView
        name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        size={11}
        tintColor={palette.mutedForeground}
      />
      <Text className="text-[11px] text-foreground" numberOfLines={1}>
        {formatReminder(reminder)}
      </Text>
    </View>
  );
}
