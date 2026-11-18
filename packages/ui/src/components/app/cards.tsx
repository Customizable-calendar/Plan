/* eslint-disable react-hooks/refs -- 디자인 시스템 코드를 그대로 옮겼어요(밀기 카드의 Animated 값). 고치면 디자인 시스템 레포에도 맞춰요. */
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import type { CardType } from '../../lib/design/tokens';
import { cn } from '../../lib/utils';
import { CheckIcon, Trash2Icon } from 'lucide-react-native';
import * as React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';

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

// ---- 아래는 개편안에서 더한 컴포넌트예요 (docs/redesign.md, docs/benchmark/README.md) ----

/** 카드 종류 색 띠가 왼쪽에 붙은 한 줄. 상자 테두리 대신 색 띠와 여백으로 구분해요 */
export function RailCard({
  type,
  title,
  meta,
  right,
  done = false,
}: {
  type: CardType;
  title: string;
  meta?: string;
  right?: React.ReactNode;
  done?: boolean;
}) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3 py-2">
      <View className={cn('w-1 self-stretch rounded-full', TYPE_DOT[type])} />
      <View className="flex-1 gap-0.5">
        <Text
          className={cn(
            'text-[15px] font-semibold text-foreground',
            done && 'text-muted-foreground line-through',
          )}
        >
          {title}
        </Text>
        {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
      </View>
      {right ?? <Text className="text-xs text-muted-foreground">{TYPE_LABEL[type]}</Text>}
    </View>
  );
}

/** 카드 목록의 한 줄. 상자 없이 왼쪽 색 띠와 글자만 써요. 줄 사이는 구분선으로 나누고, 길게 누르면 동작 시트가 열려요 */
export function CardListRow({
  type,
  title,
  meta,
  state = 'suggested',
  selected = false,
  onConfirm,
  onMore,
}: {
  type: CardType;
  title: string;
  meta?: string;
  state?: CardState;
  selected?: boolean;
  onConfirm?: () => void;
  onMore?: () => void;
}) {
  const suggested = state === 'suggested';
  return (
    <Pressable
      onLongPress={onMore}
      className={cn(
        'min-h-[56px] flex-row items-center gap-3 py-2.5',
        selected && '-mx-2 rounded-md bg-accent px-2',
      )}
    >
      <View className={cn('w-1 self-stretch rounded-full', TYPE_DOT[type])} />
      <View className="flex-1 gap-0.5">
        <Text
          className={cn(
            'text-base font-semibold text-foreground',
            state === 'dismissed' && 'text-muted-foreground line-through',
          )}
        >
          {title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className={cn('text-xs font-bold', TYPE_TEXT[type])}>{TYPE_LABEL[type]}</Text>
          {meta ? (
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      {suggested ? (
        <Pressable
          onPress={onConfirm}
          className="h-11 justify-center pl-3"
          accessibilityLabel={`${title} 확인`}
        >
          <Text className="text-[15px] font-bold text-primary">확인</Text>
        </Pressable>
      ) : state === 'confirmed' ? (
        <Icon as={CheckIcon} size={16} className="text-muted-foreground" />
      ) : null}
    </Pressable>
  );
}

/**
 * 옆으로 밀어서 처리하는 줄. 오른쪽으로 밀면 확인, 왼쪽으로 밀면 버리기예요.
 * 80 넘게 밀고 놓으면 처리하고, 덜 밀면 제자리로 돌아와요. 세로 스크롤은 막지 않아요.
 */
export function SwipeRow({
  children,
  onConfirm,
  onDismiss,
  peek = 0,
}: {
  children: React.ReactNode;
  /** 없으면 오른쪽으로는 밀리지 않아요 (이미 확인한 카드) */
  onConfirm?: () => void;
  onDismiss?: () => void;
  /** 처음부터 밀려 있는 만큼. 목업에서 밀린 모습을 보여 줄 때만 써요 */
  peek?: number;
}) {
  const x = React.useRef(new Animated.Value(peek)).current;
  const act = React.useRef({ onConfirm, onDismiss });
  act.current = { onConfirm, onDismiss };
  const pan = React.useRef(
    PanResponder.create({
      // 줄 안의 누르는 요소(Pressable)보다 먼저 가로 밀기를 잡아요
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const dx = peek + g.dx;
        x.setValue(
          dx > 0 && !act.current.onConfirm
            ? dx * 0.2
            : dx < 0 && !act.current.onDismiss
              ? dx * 0.2
              : dx,
        );
      },
      onPanResponderRelease: (_, g) => {
        const dx = peek + g.dx;
        if (dx > 80 && act.current.onConfirm) act.current.onConfirm();
        else if (dx < -80 && act.current.onDismiss) act.current.onDismiss();
        Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
      },
    }),
  ).current;
  const confirmOpacity = x.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const dismissOpacity = x.interpolate({
    inputRange: [-24, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  return (
    <View className="overflow-hidden">
      {/* Animated.View 에는 className 이 안 먹어서 위치는 style 로, 모양은 안쪽 View 의 className 으로 줘요 */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          opacity: confirmOpacity,
        }}
      >
        <View className="flex-1 flex-row items-center gap-2 bg-primary px-4">
          <Icon as={CheckIcon} size={18} className="text-primary-foreground" />
          <Text className="text-[15px] font-bold text-primary-foreground">확인</Text>
        </View>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          opacity: dismissOpacity,
        }}
      >
        <View className="flex-1 flex-row items-center justify-end gap-2 bg-muted px-4">
          <Text className="text-[15px] font-bold text-foreground">버리기</Text>
          <Icon as={Trash2Icon} size={18} className="text-foreground" />
        </View>
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <View className="bg-background">{children}</View>
      </Animated.View>
    </View>
  );
}
