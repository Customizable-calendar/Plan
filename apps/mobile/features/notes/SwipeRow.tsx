import { palette, space } from '@noteapp/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Text, View } from 'react-native';

// 이만큼(px) 넘기면 동작해요. 덜 넘기면 제자리로 돌아와요.
const THRESHOLD = 80;
// 웹은 네이티브 애니메이션을 못 써서 끄고, 앱에서만 켜요.
const native = Platform.OS !== 'web';

interface Action {
  label: string;
  icon: SymbolViewProps['name'];
  run: () => void;
}

interface Props {
  children: ReactNode;
  /** 왼쪽으로 넘겼을 때 할 일 */
  left?: Action;
  /** 오른쪽으로 넘겼을 때 할 일 */
  right?: Action;
}

/**
 * 옆으로 넘겨서 동작하는 한 줄. 넘기는 동안 뒤에 무엇을 할지 글자와 아이콘으로 보여줘요.
 * PanResponder: 손가락(웹은 마우스)을 끄는 움직임을 읽는 React Native 기본 도구예요.
 */
export function SwipeRow({ children, left, right }: Props) {
  // useState(() => ...): 처음 한 번만 만들고 다시 그려도 같은 값을 써요.
  const [x] = useState(() => new Animated.Value(0));

  // useMemo: left/right가 바뀔 때만 새로 만들어요. 넘기는 동안에는 다시 그리지 않아서 끊기지 않아요.
  const responder = useMemo(() => {
    const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: native }).start();
    return PanResponder.create({
      // Capture: 안쪽 말풍선(꾹 누르기)보다 먼저, 옆으로 끄는 움직임이면 넘기기로 가져와요.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => {
        // 할 일이 없는 쪽으로는 움직이지 않아요.
        x.setValue((g.dx < 0 && left) || (g.dx > 0 && right) ? g.dx : 0);
      },
      onPanResponderRelease: (_, g) => {
        const action = g.dx < -THRESHOLD ? left : g.dx > THRESHOLD ? right : undefined;
        if (!action) return back();
        // 화면 밖으로 밀어낸 뒤 동작하고, 자리는 원래대로 돌려 둬요.
        Animated.timing(x, {
          toValue: g.dx < 0 ? -500 : 500,
          duration: 150,
          useNativeDriver: native,
        }).start(() => {
          action.run();
          x.setValue(0);
        });
      },
      onPanResponderTerminate: back,
    });
  }, [x, left, right]);

  // 넘긴 만큼 뒤쪽 안내가 또렷해져요. interpolate: x 값을 0~1 투명도로 바꿔요.
  const leftHint = x.interpolate({
    inputRange: [-THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const rightHint = x.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View>
      {right ? <Hint action={right} side="left" opacity={rightHint} /> : null}
      {left ? <Hint action={left} side="right" opacity={leftHint} /> : null}
      {/* Animated.View는 className 대신 style로 움직임을 줘요. */}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/** 뒤에 깔리는 안내. 왼쪽으로 넘기면 오른쪽 끝에, 오른쪽으로 넘기면 왼쪽 끝에 보여요. */
function Hint({
  action,
  side,
  opacity,
}: {
  action: Action;
  side: 'left' | 'right';
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  const danger = side === 'right'; // 왼쪽으로 넘기기(버리기)는 빨간색
  return (
    // 자리 잡기는 보통 View(className)로, 투명도 애니메이션만 Animated.View(style)로 해요.
    <View
      className={`pointer-events-none absolute inset-0 px-4 ${side === 'right' ? 'items-end' : 'items-start'} justify-center`}
    >
      <Animated.View style={{ opacity, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <SymbolView
          name={action.icon}
          size={16}
          tintColor={danger ? palette.destructive : palette.primary}
        />
        <Text
          className={`text-[13px] font-semibold ${danger ? 'text-destructive' : 'text-primary'}`}
        >
          {action.label}
        </Text>
      </Animated.View>
    </View>
  );
}
