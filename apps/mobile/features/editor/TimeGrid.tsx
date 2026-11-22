import { Pressable, Text, View } from 'react-native';

import { minutesLabel, SLOTS_PER_HOUR } from './widgets';

interface Props {
  /** 칠한 10분 칸 번호들 (0 = 0시 0분부터 10분) */
  slots: Set<number>;
  onChange: (slots: Set<number>) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const PARTS = Array.from({ length: SLOTS_PER_HOUR }, (_, i) => i);

/**
 * 시간 기록: 0시부터 24시까지, 한 줄이 한 시간, 한 칸이 10분이에요. 공부한 칸을 눌러 칠해요.
 * 시각 글자를 누르면 그 한 시간을 한꺼번에 칠하거나 지워요. 새벽에 공부하는 사람도 있어서 24시간 다 보여줘요.
 */
export function TimeGrid({ slots, onChange }: Props) {
  function toggle(list: number[]) {
    const next = new Set(slots);
    // 다 칠해져 있으면 지우고, 하나라도 비어 있으면 다 칠해요.
    const fill = list.some((s) => !next.has(s));
    for (const s of list) {
      if (fill) next.add(s);
      else next.delete(s);
    }
    onChange(next);
  }

  return (
    <View className="overflow-hidden rounded-lg border border-border">
      <View className="flex-row items-center justify-between bg-muted px-3 py-2">
        <Text className="text-xs font-semibold text-muted-foreground">
          10분이 한 칸, 공부한 칸을 눌러 칠해요
        </Text>
        <Text className="text-xs text-muted-foreground">
          순공부{' '}
          <Text className="font-semibold text-foreground">{minutesLabel(slots.size * 10)}</Text>
        </Text>
      </View>
      {HOURS.map((h) => {
        const hourSlots = PARTS.map((p) => h * SLOTS_PER_HOUR + p);
        return (
          <View key={h} className="h-7 flex-row border-t border-border">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${h}시 한 시간 칠하기`}
              onPress={() => toggle(hourSlots)}
              className="w-9 items-center justify-center border-r border-border active:bg-muted"
            >
              <Text className="text-[11px] text-muted-foreground">{h}</Text>
            </Pressable>
            {hourSlots.map((s, i) => {
              const on = slots.has(s);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${h}시 ${i * 10}분`}
                  onPress={() => toggle([s])}
                  // 30분마다 선을 진하게 해서 칸을 세기 쉽게 해요.
                  className={`flex-1 ${i === 0 ? '' : i === 3 ? 'border-l border-border' : 'border-l border-border/50'} ${
                    on ? 'bg-primary' : 'active:bg-muted'
                  }`}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
