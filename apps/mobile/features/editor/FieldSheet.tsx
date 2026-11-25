import { Button, MonthGrid, type MonthDay, palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { longDate } from './format';

// 표(- 이름: 값) 칸을 쉽게 채우는 시트. 이름을 보고 날짜는 달력, 사람은 메일, 장소는 지도로 골라요.

export type FieldKind = 'date' | 'people' | 'place';

/** 칸 이름으로 어떤 도우미를 붙일지 정해요. 맞는 게 없으면 null */
export function fieldKind(label: string): FieldKind | null {
  if (/날짜|일시|마감|기한/.test(label)) return 'date';
  if (/사람|참석자|담당|저자|작성자|함께/.test(label)) return 'people';
  if (/장소|위치/.test(label)) return 'place';
  return null;
}

export interface FieldTarget {
  line: number;
  label: string;
  value: string;
  kind: FieldKind;
}

interface Props {
  target: FieldTarget | null;
  onDone: (value: string) => void;
  onClose: () => void;
}

const TITLES: Record<FieldKind, string> = {
  date: '날짜 고르기',
  people: '사람 넣기',
  place: '장소 넣기',
};

export function FieldSheet({ target, onDone, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-foreground/30" onPress={onClose} accessibilityLabel="닫기" />
      <View
        className="max-h-[85%] rounded-t-2xl bg-popover"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-full bg-border" />
        </View>
        <View className="flex-row items-center justify-between px-5 pb-2">
          <Text className="text-lg font-bold text-popover-foreground">
            {target ? `${target.label}: ${TITLES[target.kind]}` : ''}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text className="text-sm text-muted-foreground">닫기</Text>
          </Pressable>
        </View>
        {/* key로 칸마다 새로 그려서, 앞 칸에서 고르던 값이 남지 않게 해요. */}
        {target?.kind === 'date' ? <DatePane key={target.line} onDone={onDone} /> : null}
        {target?.kind === 'people' ? (
          <PeoplePane key={target.line} value={target.value} onDone={onDone} />
        ) : null}
        {target?.kind === 'place' ? (
          <PlacePane key={target.line} value={target.value} onDone={onDone} />
        ) : null}
      </View>
    </Modal>
  );
}

/** 그 달의 주들. 앞뒤 달 날짜는 out으로 채워요. */
function monthWeeks(year: number, month: number): MonthDay[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: MonthDay[] = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ date: prevDays - i, out: true });
  for (let d = 1; d <= days; d++) cells.push({ date: d });
  let next = 1;
  while (cells.length % 7) cells.push({ date: next++, out: true });
  const weeks: MonthDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function DatePane({ onDone }: { onDone: (value: string) => void }) {
  const now = new Date();
  const [shown, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const isThisMonth = shown.year === now.getFullYear() && shown.month === now.getMonth();

  function move(step: number) {
    const d = new Date(shown.year, shown.month + step, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <View className="gap-2 px-5 pb-2">
      <View className="flex-row items-center justify-between">
        <MonthButton label="이전 달" direction="left" onPress={() => move(-1)} />
        <Text className="text-base font-semibold text-foreground">
          {shown.year}년 {shown.month + 1}월
        </Text>
        <MonthButton label="다음 달" direction="right" onPress={() => move(1)} />
      </View>
      <MonthGrid
        compact
        weeks={monthWeeks(shown.year, shown.month)}
        today={isThisMonth ? now.getDate() : undefined}
        // 날짜를 누르면 바로 그 날로 채워요. 예: 2026년 11월 21일 (토)
        onSelect={(date) =>
          onDone(longDate(new Date(shown.year, shown.month, date, 12).toISOString()))
        }
      />
    </View>
  );
}

function MonthButton(props: { label: string; direction: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-md active:bg-muted"
    >
      <SymbolView
        name={
          props.direction === 'left'
            ? { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }
        }
        size={18}
        tintColor={palette.foreground}
      />
    </Pressable>
  );
}

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** 사람: 메일 주소로 받아요(메모의 공동 작업자와 같은 방식). 칸에는 쉼표로 이어서 적어요. */
function PeoplePane({ value, onDone }: { value: string; onDone: (value: string) => void }) {
  const [emails, setEmails] = useState(() =>
    value
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter((v) => EMAIL.test(v)),
  );
  const [typed, setTyped] = useState('');
  const bad = typed.trim() !== '' && !EMAIL.test(typed.trim());

  function add() {
    const email = typed.trim().toLowerCase();
    if (!EMAIL.test(email)) return;
    if (!emails.includes(email)) setEmails([...emails, email]);
    setTyped('');
  }

  return (
    <View className="gap-3 px-5 pb-2">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={add}
          // 엔터로 추가한 뒤에도 입력칸에 커서를 남겨서 이어서 적게 해요.
          submitBehavior="submit"
          placeholder="이메일 입력"
          placeholderTextColor={palette.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="사람 이메일"
          className="h-10 flex-1 rounded-md border border-input px-3 text-base text-foreground web:outline-none"
        />
        <Button size="sm" variant="soft" disabled={!typed.trim() || bad} onPress={add}>
          <Text className="text-sm font-medium text-primary-soft-foreground">추가</Text>
        </Button>
      </View>
      {bad ? <Text className="text-xs text-destructive">메일 주소 모양이 아니에요.</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {emails.map((e) => (
          <Pressable
            key={e}
            accessibilityRole="button"
            accessibilityLabel={`${e} 빼기`}
            onPress={() => setEmails(emails.filter((x) => x !== e))}
            className="flex-row items-center gap-1 rounded-full bg-muted px-3 py-1"
          >
            <Text className="text-sm text-foreground">{e}</Text>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={12}
              tintColor={palette.mutedForeground}
            />
          </Pressable>
        ))}
      </ScrollView>
      <Button onPress={() => onDone(emails.join(', '))}>
        <Text className="font-medium text-primary-foreground">완료</Text>
      </Button>
    </View>
  );
}

// 지도 앱 검색 주소. 앱에서 따로 위치 정보를 보내지 않고, 고른 지도 앱(웹)에서 장소를 찾아요.
const MAPS: { label: string; url: (q: string) => string }[] = [
  { label: '카카오맵', url: (q) => `https://map.kakao.com/link/search/${encodeURIComponent(q)}` },
  { label: '네이버 지도', url: (q) => `https://map.naver.com/p/search/${encodeURIComponent(q)}` },
  {
    label: '구글 지도',
    url: (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
  },
];

/** 장소: 이름을 적고, 지도 앱에서 확인해요. 칸에는 장소 이름을 적어요. */
function PlacePane({ value, onDone }: { value: string; onDone: (value: string) => void }) {
  const [place, setPlace] = useState(value);
  const query = place.trim();

  return (
    <View className="gap-3 px-5 pb-2">
      <TextInput
        value={place}
        onChangeText={setPlace}
        placeholder="장소 이름이나 주소 (예: 강남역 2번 출구)"
        placeholderTextColor={palette.mutedForeground}
        accessibilityLabel="장소"
        className="h-10 rounded-md border border-input px-3 text-base text-foreground web:outline-none"
      />
      <View className="flex-row flex-wrap gap-2">
        {MAPS.map((m) => (
          <Button
            key={m.label}
            size="sm"
            variant="outline"
            disabled={!query}
            onPress={() => void Linking.openURL(m.url(query))}
          >
            <Text className="text-sm text-foreground">{m.label}에서 보기</Text>
          </Button>
        ))}
      </View>
      <Button disabled={!query} onPress={() => onDone(query)}>
        <Text className="font-medium text-primary-foreground">완료</Text>
      </Button>
    </View>
  );
}
