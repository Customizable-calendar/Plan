import { colors, fontSize, space } from '@noteapp/ui';
import { type ReactNode, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';

import { setDragging } from './dragging';
import { confirmCard, dismissCard } from './store';

// 확인 기다리는 카드를 오른쪽으로 밀면 확인, 왼쪽으로 밀면 버리기.
// 새 라이브러리 없이 RN PanResponder로 만들었어요. 세로 스크롤과 버튼 누르기는 그대로 돼요.

const THRESHOLD = 96;

const isHorizontal = (g: { dx: number; dy: number }) =>
  Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2;

export function SwipeRow({ cardId, children }: { cardId: string; children: ReactNode }) {
  const [x] = useState(() => new Animated.Value(0));
  const [responder] = useState(() =>
    PanResponder.create({
      // 가로로 확실히 밀 때만 ScrollView보다 먼저 잡고, 미는 동안 스크롤을 꺼요.
      onMoveShouldSetPanResponder: (_, g) => isHorizontal(g),
      onMoveShouldSetPanResponderCapture: (_, g) => isHorizontal(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        if (Math.abs(g.dx) < THRESHOLD) {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
          return;
        }
        const right = g.dx > 0;
        const width = Dimensions.get('window').width;
        Animated.timing(x, {
          toValue: right ? width : -width,
          duration: 160,
          useNativeDriver: false,
        }).start(() => {
          x.setValue(0);
          void (right ? confirmCard(cardId) : dismissCard(cardId));
        });
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
  );

  const confirmOpacity = x.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const dismissOpacity = x.interpolate({
    inputRange: [-THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <Animated.View style={[styles.under, styles.confirm, { opacity: confirmOpacity }]}>
        <Text style={styles.underText}>확인</Text>
      </Animated.View>
      <Animated.View style={[styles.under, styles.dismiss, { opacity: dismissOpacity }]}>
        <Text style={styles.underText}>버리기</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  under: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: 12,
  },
  confirm: { backgroundColor: colors.accent, alignItems: 'flex-start' },
  dismiss: { backgroundColor: colors.muted, alignItems: 'flex-end' },
  underText: { fontSize: fontSize.body, fontWeight: '700', color: colors.surface },
});
