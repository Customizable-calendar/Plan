import type { Card } from '@noteapp/shared';
import { colors, fontSize, space } from '@noteapp/ui';
import { useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CardItem } from './CardItem';
import { setDragging } from './dragging';
import { look } from './look';
import { confirmCard, dismissCard } from './store';

// 확인 기다리는 카드를 한 장씩 넘겨요. 오른쪽 = 확인, 왼쪽 = 버리기.
// 맨 위 카드는 카드 id를 key로 다시 만들어서, 손 제스처가 항상 지금 카드를 가리켜요.

const THRESHOLD = 110;
const FLING = 0.8;

const isHorizontal = (g: { dx: number; dy: number }) =>
  Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;

export function CardDeck({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.deck}>
      <Text style={styles.count}>남은 카드 {cards.length}장</Text>
      <TopCard key={cards[0].id} card={cards[0]} next={cards[1]} />
    </View>
  );
}

function TopCard({ card, next }: { card: Card; next?: Card }) {
  const [pos] = useState(() => new Animated.ValueXY());

  const [fly] = useState(() => (right: boolean, dy = 0) => {
    const width = Dimensions.get('window').width;
    Animated.timing(pos, {
      toValue: { x: (right ? 1 : -1) * width * 1.5, y: dy },
      duration: 220,
      useNativeDriver: false,
    }).start(() => void (right ? confirmCard(card.id) : dismissCard(card.id)));
  });

  const [responder] = useState(() =>
    PanResponder.create({
      // 가로로 미는 게 보이면 ScrollView보다 먼저(capture) 잡고, 미는 동안 스크롤을 꺼요.
      onMoveShouldSetPanResponder: (_, g) => isHorizontal(g),
      onMoveShouldSetPanResponderCapture: (_, g) => isHorizontal(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        if (Math.abs(g.dx) > THRESHOLD || Math.abs(g.vx) > FLING) fly(g.dx > 0, g.dy);
        else
          Animated.spring(pos, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    }),
  );

  const rotate = pos.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });
  const confirmStamp = pos.x.interpolate({
    inputRange: [20, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const dismissStamp = pos.x.interpolate({
    inputRange: [-THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // 위 카드를 밀수록 뒤 카드가 커지며 올라와요.
  const nextScale = pos.x.interpolate({
    inputRange: [-THRESHOLD, 0, THRESHOLD],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.stackArea}>
      <View>
        {next && (
          <Animated.View
            pointerEvents="none"
            style={[styles.behind, { transform: [{ scale: nextScale }, { translateY: 18 }] }]}
          >
            <CardItem card={next} />
          </Animated.View>
        )}
        <Animated.View
          {...responder.panHandlers}
          style={[
            styles.top,
            { transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] },
          ]}
        >
          <CardItem card={card} />
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.stampLeft, { opacity: confirmStamp }]}
          >
            <Text style={[styles.stampText, { color: look.primary }]}>확인</Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.stamp,
              styles.stampRight,
              { borderColor: colors.muted, opacity: dismissStamp },
            ]}
          >
            <Text style={[styles.stampText, { color: colors.muted }]}>버리기</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => fly(false)}
          accessibilityRole="button"
          accessibilityLabel="버리기"
          style={[styles.round, styles.roundDismiss]}
        >
          <Text style={[styles.roundText, { color: colors.muted }]}>✕</Text>
        </Pressable>
        <Pressable
          onPress={() => fly(true)}
          accessibilityRole="button"
          accessibilityLabel="확인"
          style={[styles.round, styles.roundConfirm]}
        >
          <Text style={[styles.roundText, { color: colors.surface }]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { gap: space.sm },
  count: { fontSize: fontSize.caption, color: colors.muted, textAlign: 'center' },
  stackArea: { gap: space.xl, paddingTop: space.sm },
  behind: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.9 },
  top: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderRadius: look.radius,
    backgroundColor: colors.surface,
  },
  stamp: {
    position: 'absolute',
    top: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderWidth: 3,
    borderColor: look.primary,
    borderRadius: look.radius - 4,
    backgroundColor: colors.surface,
  },
  // 오른쪽으로 밀면 왼쪽 위에 "확인", 왼쪽으로 밀면 오른쪽 위에 "버리기"
  stampLeft: { left: space.md, transform: [{ rotate: '-12deg' }] },
  stampRight: { right: space.md, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: fontSize.title, fontWeight: '800', letterSpacing: 2 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  roundDismiss: { borderColor: colors.line, backgroundColor: colors.surface },
  roundConfirm: { borderColor: look.primary, backgroundColor: look.primary },
  roundText: { fontSize: 26, fontWeight: '700' },
});
