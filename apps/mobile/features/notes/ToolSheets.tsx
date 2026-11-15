import type { NoteReminder } from '@noteapp/shared';
import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import {
  dayKeyOf,
  formatReminders,
  isEmail,
  makeReminders,
  monthWeeks,
  parseNumber,
  to24Hour,
} from './format';

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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface ReminderProps {
  current: NoteReminder[];
  onPick: (reminders: NoteReminder[]) => void;
  onClose: () => void;
}

export function ReminderSheet({ visible, ...props }: ReminderProps & { visible: boolean }) {
  return (
    <Sheet visible={visible} title="리마인드" onClose={props.onClose}>
      {/* 열 때마다 새로 그려서, 고르다 만 날짜가 다음에 남지 않게 해요. */}
      {visible ? <ReminderCalendar {...props} /> : null}
    </Sheet>
  );
}

/** 달력에서 날짜를 여러 개 고르고, 알림 시각(오전 오후, 시, 분) 하나를 정해요. */
function ReminderCalendar({ current, onPick, onClose }: ReminderProps) {
  const today = new Date();
  const todayKey = dayKeyOf(today);
  // 지금 보고 있는 달. month는 0(1월)부터예요.
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  // 고른 날짜들. 이미 정한 리마인드가 있으면 그 날짜에서 시작해요. 지난 날은 빼요.
  const [days, setDays] = useState(() =>
    current.map((r) => dayKeyOf(new Date(r.at))).filter((key) => key >= todayKey),
  );
  // 알림 시각. 이미 정한 리마인드가 있으면 그 시각에서, 없으면 오전 9:00에서 시작해요.
  const saved = current[0] ? new Date(current[0].at) : null;
  const savedHour = saved ? saved.getHours() : 9;
  const [meridiem, setMeridiem] = useState<'am' | 'pm'>(savedHour < 12 ? 'am' : 'pm');
  // 시와 분은 입력칸이라 글자로 들고 있어요. 저장할 때 숫자로 바꿔요.
  const [hourText, setHourText] = useState(String(savedHour % 12 || 12));
  const [minuteText, setMinuteText] = useState(
    String(saved ? saved.getMinutes() : 0).padStart(2, '0'),
  );
  const hour12 = parseNumber(hourText, 1, 12);
  const minute = parseNumber(minuteText, 0, 59);
  const timeOk = hour12 !== null && minute !== null;
  const ready = days.length > 0 && timeOk;

  const toggle = (key: string) =>
    setDays((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // 달을 넘겨요. Date가 12월 다음을 다음 해 1월로 알아서 바꿔 줘요.
  const move = (step: number) => {
    const next = new Date(view.year, view.month + step, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const done = (reminders: NoteReminder[]) => {
    onPick(reminders);
    onClose();
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <MonthButton label="이전 달" direction="left" onPress={() => move(-1)} />
        <Text className="text-base font-bold text-foreground">
          {view.year}년 {view.month + 1}월
        </Text>
        <MonthButton label="다음 달" direction="right" onPress={() => move(1)} />
      </View>

      <View className="gap-1">
        <View className="flex-row gap-1">
          {WEEKDAYS.map((w) => (
            <Text key={w} className="flex-1 text-center text-[11px] text-muted-foreground">
              {w}
            </Text>
          ))}
        </View>
        {monthWeeks(view.year, view.month).map((week, row) => (
          <View key={row} className="flex-row gap-1">
            {week.map((date, col) => {
              if (!date) return <View key={col} className="flex-1" />;
              const key = dayKeyOf(date);
              const on = days.includes(key);
              const past = key < todayKey; // 지난 날은 고를 수 없어요.
              return (
                <Pressable
                  key={col}
                  accessibilityRole="button"
                  accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일`}
                  accessibilityState={{ selected: on, disabled: past }}
                  disabled={past}
                  onPress={() => toggle(key)}
                  className={`h-10 flex-1 items-center justify-center rounded-lg ${
                    on ? 'bg-primary' : key === todayKey ? 'border border-primary' : ''
                  }`}
                >
                  <Text
                    className={`text-[15px] ${
                      on
                        ? 'font-bold text-primary-foreground'
                        : past
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] text-muted-foreground">알림 시각</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Chip label="오전" selected={meridiem === 'am'} onPress={() => setMeridiem('am')} />
          <Chip label="오후" selected={meridiem === 'pm'} onPress={() => setMeridiem('pm')} />
          <TimeInput label="시" value={hourText} onChange={setHourText} bad={hour12 === null} />
          <TimeInput label="분" value={minuteText} onChange={setMinuteText} bad={minute === null} />
        </View>
        {timeOk ? null : (
          <Text className="text-[13px] text-destructive">
            시는 1부터 12까지, 분은 0부터 59까지 넣어 주세요.
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => {
          if (hour12 === null || minute === null) return;
          done(makeReminders(days, to24Hour(meridiem, hour12), minute));
        }}
        className={`h-11 items-center justify-center rounded-md ${
          ready ? 'bg-primary active:opacity-80' : 'bg-muted'
        }`}
      >
        <Text
          className={`text-base font-bold ${
            ready ? 'text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          {days.length === 0
            ? '날짜를 골라 주세요'
            : timeOk
              ? `${days.length}일 정하기`
              : '시간을 확인해 주세요'}
        </Text>
      </Pressable>
      {current.length ? <Option label="리마인드 지우기" onPress={() => done([])} /> : null}
    </View>
  );
}

/** 시나 분을 숫자로 넣는 작은 입력칸. 뒤에 "시", "분" 글자가 붙어요. */
function TimeInput({
  label,
  value,
  onChange,
  bad,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  bad: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <TextInput
        value={value}
        // 숫자만, 두 자리까지 받아요.
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        accessibilityLabel={label}
        className={`h-10 w-12 rounded-md border px-2 text-center text-base text-foreground ${
          bad ? 'border-destructive' : 'border-input'
        }`}
      />
      <Text className="text-base text-foreground">{label}</Text>
    </View>
  );
}

function MonthButton({
  label,
  direction,
  onPress,
}: {
  label: string;
  direction: 'left' | 'right';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-md active:bg-muted"
    >
      <SymbolView
        name={
          direction === 'left'
            ? { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }
        }
        size={20}
        tintColor={palette.foreground}
      />
    </Pressable>
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
export function ReminderBadge({ reminders }: { reminders: NoteReminder[] }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5">
      <SymbolView
        name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        size={11}
        tintColor={palette.mutedForeground}
      />
      <Text className="text-[11px] text-foreground" numberOfLines={1}>
        {formatReminders(reminders)}
      </Text>
    </View>
  );
}
