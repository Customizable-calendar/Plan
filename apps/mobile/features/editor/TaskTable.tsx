import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, TextInput, View } from 'react-native';

import { nextResult, summarize, type TaskResult, type TaskRow } from './tasks';

interface Props {
  rows: TaskRow[];
  /** 한 줄을 바꿔요(본문의 그 줄). */
  onRow: (row: TaskRow) => void;
  /** 빈 줄을 하나 더해요. */
  onAdd: () => void;
  /** 그 줄을 지워요. */
  onRemove: (row: TaskRow) => void;
}

// 결과 칸 색. 글자(O, △, X)와 색을 함께 써서 색만으로 구분하지 않아요.
const RESULT_STYLE: Record<
  Exclude<TaskResult, ''>,
  { box: string; text: string; label: string }
> = {
  O: { box: 'bg-primary', text: 'text-primary-foreground', label: '다 함' },
  '△': { box: 'bg-secondary-soft', text: 'text-secondary-soft-foreground', label: '조금 함' },
  X: { box: 'bg-muted', text: 'text-muted-foreground', label: '못 함' },
};

/** 할 일 표: 과목, 할 일, 예상 분, 실제 분, 결과(O, △, X). 칸을 눌러 바로 고쳐요. */
export function TaskTable({ rows, onRow, onAdd, onRemove }: Props) {
  const sum = summarize(rows);
  const change = (row: TaskRow, patch: Partial<TaskRow>) => onRow({ ...row, ...patch });

  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {/* 머리 줄 */}
      <View className="flex-row items-center gap-2 bg-muted px-3 py-2">
        <Text className="w-16 text-xs font-semibold text-muted-foreground">과목</Text>
        <Text className="flex-1 text-xs font-semibold text-muted-foreground">할 일</Text>
        <Text className="w-11 text-center text-xs font-semibold text-muted-foreground">예상</Text>
        <Text className="w-11 text-center text-xs font-semibold text-muted-foreground">실제</Text>
        <Text className="w-9 text-center text-xs font-semibold text-muted-foreground">결과</Text>
        <View className="w-5" />
      </View>

      {rows.map((row) => (
        <View
          key={row.line}
          className="flex-row items-center gap-2 border-t border-border px-3 py-1.5"
        >
          <Cell
            value={row.subject}
            placeholder="과목"
            label="과목"
            className="w-16"
            onChange={(subject) => change(row, { subject })}
          />
          <Cell
            value={row.task}
            placeholder="범위, 교재, 문제 수까지"
            label="할 일"
            className="min-w-0 flex-1"
            wrap
            onChange={(task) => change(row, { task })}
          />
          <Cell
            value={row.plan}
            placeholder="분"
            label="예상 분"
            className="w-11 text-center"
            numeric
            onChange={(plan) => change(row, { plan })}
          />
          <Cell
            value={row.actual}
            placeholder="분"
            label="실제 분"
            className="w-11 text-center"
            numeric
            onChange={(actual) => change(row, { actual })}
          />
          <ResultButton
            result={row.result}
            onPress={() => change(row, { result: nextResult(row.result) })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.task || '할 일'} 줄 지우기`}
            hitSlop={6}
            onPress={() => onRemove(row)}
            className="h-5 w-5 items-center justify-center"
          >
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={13}
              tintColor={palette.mutedForeground}
            />
          </Pressable>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        className="flex-row items-center gap-1.5 border-t border-border px-3 py-2 active:bg-muted"
      >
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          size={15}
          tintColor={palette.primary}
        />
        <Text className="text-sm font-medium text-primary">할 일 추가</Text>
      </Pressable>

      {/* 결산 한 줄: 표에 적은 것만으로 계산해요. */}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1 border-t border-border bg-muted px-3 py-2">
        <Stat label="다 함" value={`${sum.done}개`} />
        <Stat label="조금 함" value={`${sum.partly}개`} />
        <Stat label="못 함" value={`${sum.missed}개`} />
        <Stat label="달성" value={sum.rate === null ? '아직 없음' : `${sum.rate}%`} />
        <Stat label="예상" value={`${sum.planMinutes}분`} />
        <Stat label="실제" value={`${sum.actualMinutes}분`} />
      </View>
    </View>
  );
}

function Cell(props: {
  value: string;
  placeholder: string;
  label: string;
  className: string;
  numeric?: boolean;
  /** 길면 줄을 넘겨 다 보여줘요(할 일 칸). */
  wrap?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextInput
      value={props.value}
      // 표 한 칸은 한 줄이라 줄바꿈과 칸 구분 글자는 받지 않아요.
      onChangeText={(text) => props.onChange(text.replace(/[\n|]/g, ' '))}
      placeholder={props.placeholder}
      placeholderTextColor={palette.mutedForeground}
      accessibilityLabel={props.label}
      keyboardType={props.numeric ? 'number-pad' : 'default'}
      multiline={props.wrap}
      rows={1}
      scrollEnabled={false}
      // 웹 입력칸은 기본 최소 너비가 있어 좁은 화면에서 줄지 않아요. min-w-0으로 줄 수 있게 해요.
      className={`min-w-0 p-0 text-sm leading-6 text-foreground web:outline-none ${props.wrap ? 'web:[field-sizing:content]' : ''} ${props.className}`}
    />
  );
}

function ResultButton({ result, onPress }: { result: TaskResult; onPress: () => void }) {
  const style = result ? RESULT_STYLE[result] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`결과: ${style?.label ?? '아직 안 정함'}. 누르면 바뀌어요`}
      onPress={onPress}
      className={`h-7 w-9 items-center justify-center rounded-md ${
        style ? style.box : 'border border-dashed border-border'
      }`}
    >
      <Text className={`text-sm font-bold ${style ? style.text : 'text-muted-foreground'}`}>
        {result || ' '}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Text className="text-xs text-muted-foreground">
      {label} <Text className="font-semibold text-foreground">{value}</Text>
    </Text>
  );
}
