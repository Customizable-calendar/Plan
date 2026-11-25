import { Pressable, Text, View } from 'react-native';

import type { TaskSummary } from './tasks';
import { CONDITIONS, minutesLabel } from './widgets';

interface Props {
  /** 같은 문서의 할 일 표에서 모은 숫자. 표가 없으면 null */
  tasks: TaskSummary | null;
  /** 같은 문서의 시간 기록에서 모은 순공부 분. 시간 기록이 없으면 null */
  studyMinutes: number | null;
  condition: string;
  onCondition: (condition: string) => void;
}

/** 숫자 결산: 할 일 표와 시간 기록에서 숫자를 자동으로 모으고, 컨디션만 골라요. */
export function SummaryCard({ tasks, studyMinutes, condition, onCondition }: Props) {
  return (
    <View className="gap-3 rounded-lg border border-border p-3">
      <View className="flex-row flex-wrap gap-2">
        <Stat label="다 함" value={tasks ? `${tasks.done}개` : '없음'} />
        <Stat label="조금 함" value={tasks ? `${tasks.partly}개` : '없음'} />
        <Stat label="못 함" value={tasks ? `${tasks.missed}개` : '없음'} />
        <Stat label="달성" value={tasks?.rate == null ? '아직 없음' : `${tasks.rate}%`} />
        <Stat
          label="순공부"
          value={studyMinutes == null ? '기록 없음' : minutesLabel(studyMinutes)}
        />
        <Stat label="계획" value={tasks ? minutesLabel(tasks.planMinutes) : '없음'} />
      </View>
      <View className="gap-1.5">
        <Text className="text-xs font-semibold text-muted-foreground">컨디션</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {CONDITIONS.map((c) => {
            const on = condition === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                // 같은 걸 다시 누르면 지워요.
                onPress={() => onCondition(on ? '' : c)}
                className={`rounded-full border px-3 py-1 ${
                  on ? 'border-primary bg-primary' : 'border-border active:bg-muted'
                }`}
              >
                <Text className={`text-sm ${on ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-24 flex-1 gap-0.5 rounded-md bg-muted px-3 py-2">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <Text className="text-base font-semibold text-foreground">{value}</Text>
    </View>
  );
}
