import { Button } from '../ui/button';
import { Text } from '../ui/text';
import type { CardType } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import * as React from 'react';
import { View } from 'react-native';

export const TYPE_LABEL: Record<CardType, string> = {
  event: '일정',
  task: '할 일',
  person: '사람',
  idea: '아이디어',
};

// NativeWind 는 클래스 이름을 정적으로 읽으므로 조합하지 않고 그대로 적는다
const TYPE_BG: Record<CardType, string> = {
  event: 'bg-event-soft',
  task: 'bg-task-soft',
  person: 'bg-person-soft',
  idea: 'bg-idea-soft',
};
const TYPE_TEXT: Record<CardType, string> = {
  event: 'text-event',
  task: 'text-task',
  person: 'text-person',
  idea: 'text-idea',
};
const TYPE_DOT: Record<CardType, string> = {
  event: 'bg-event',
  task: 'bg-task',
  person: 'bg-person',
  idea: 'bg-idea',
};

/** 카드 종류 칩: 색만으로 구분하지 않도록 항상 글자 라벨을 같이 쓴다 */
export function TypeChip({ type, className }: { type: CardType; className?: string }) {
  return (
    <View
      className={cn(
        'flex-row items-center self-start rounded-full px-2 py-0.5',
        TYPE_BG[type],
        className,
      )}
    >
      <Text className={cn('text-[11px] font-bold', TYPE_TEXT[type])}>{TYPE_LABEL[type]}</Text>
    </View>
  );
}

export function TypeDot({ type }: { type: CardType }) {
  return <View className={cn('h-2 w-2 rounded-full', TYPE_DOT[type])} />;
}

/** 출처 칩: 메모 · 녹음 · 캘린더 */
export function SourceChip({ label }: { label: string }) {
  return (
    <View className="self-start rounded-full bg-muted px-2 py-0.5">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </View>
  );
}

export type CardState = 'suggested' | 'confirmed' | 'dismissed';

/** AI 가 뽑은 카드. suggested 는 점선(아직 저장 안 됨), confirmed 는 실선. */
export function ExtractedCard({
  type,
  title,
  meta,
  source = '메모',
  state = 'suggested',
  actions = [{ label: '확인', primary: true }, { label: '고치기' }, { label: '버리기' }],
  className,
}: {
  type: CardType;
  title: string;
  meta?: string;
  source?: string;
  state?: CardState;
  actions?: { label: string; primary?: boolean }[];
  className?: string;
}) {
  return (
    <View
      className={cn(
        'gap-1.5 rounded-lg px-3.5 py-3',
        state === 'suggested' &&
          'border-[1.5px] border-dashed border-primary/40 bg-primary-soft/40',
        state === 'confirmed' && 'border border-border bg-card',
        state === 'dismissed' && 'border border-border bg-muted opacity-60',
        className,
      )}
    >
      <View className="flex-row items-center justify-between">
        <TypeChip type={type} />
        <SourceChip label={source} />
      </View>
      <Text
        className={cn(
          'text-[15px] font-bold text-card-foreground',
          state === 'dismissed' && 'line-through',
        )}
      >
        {title}
      </Text>
      {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
      {state === 'suggested' && actions.length ? (
        <View className="mt-1 flex-row gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.primary ? 'default' : 'outline'}
              className="h-8 px-3"
            >
              <Text className="text-[13px]">{a.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** 홈의 오늘 일정 한 줄 */
export function ScheduleRow({
  time,
  title,
  meta,
  metaTone = 'muted',
  badge,
}: {
  time: string;
  title: string;
  meta: string;
  metaTone?: 'muted' | 'external';
  badge?: string;
}) {
  return (
    <View className="flex-row items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5">
      <Text className="w-12 text-[15px] font-bold text-card-foreground">{time}</Text>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[15px] font-semibold text-card-foreground">{title}</Text>
          {badge ? <Text className="text-[13px] font-bold text-primary">{badge}</Text> : null}
        </View>
        {metaTone === 'external' ? (
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-secondary" />
            <Text className="text-xs text-secondary">{meta}</Text>
          </View>
        ) : (
          <Text className="text-xs text-muted-foreground">{meta}</Text>
        )}
      </View>
    </View>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm font-bold text-muted-foreground">{children}</Text>
      {right}
    </View>
  );
}
