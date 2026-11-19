import { Briefing, Text } from '@noteapp/ui';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useCards } from './store';

// 홈 브리핑 자리(banner). 상자 없이 큰 글자 한 줄과 설명으로 지금 확인할 카드 수를 알려 줘요.
// 숫자는 실제 카드에서만 세요. 없는 수치를 지어내지 않아요.
export function HomeBanner() {
  const { cards, loading } = useCards();
  const waiting = cards.filter((c) => c.status === 'suggested').length;
  const confirmed = cards.filter((c) => c.status === 'confirmed').length;

  const lead = loading
    ? '불러오는 중'
    : waiting > 0
      ? '확인할 카드'
      : confirmed > 0
        ? '초안 준비'
        : '오늘 브리핑';

  const title = loading
    ? '카드를 불러오는 중이에요'
    : waiting > 0
      ? `확인할 카드 ${waiting}장`
      : confirmed > 0
        ? `확인한 카드 ${confirmed}장`
        : '메모를 남겨 보세요';

  const detail = loading
    ? undefined
    : waiting > 0
      ? '확인하고 업무일지 초안을 만들어 볼까요'
      : confirmed > 0
        ? '확인한 카드로 바로 초안을 만들 수 있어요'
        : '메모를 쓰면 일정과 할 일 카드로 나눠 드려요';

  return (
    <View className="gap-3">
      <Briefing
        lead={lead}
        title={title}
        detail={detail}
        onPress={() => router.push(waiting > 0 ? '/cards' : '/draft')}
      />
      <View className="flex-row items-center gap-4">
        {waiting > 0 ? (
          <Pressable
            onPress={() => router.push('/cards')}
            accessibilityRole="button"
            className="h-9 justify-center"
          >
            <Text className="text-[15px] font-bold text-primary">카드 확인</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/draft')}
          accessibilityRole="button"
          className="h-9 justify-center"
        >
          <Text className="text-[15px] font-bold text-foreground">초안 만들기</Text>
        </Pressable>
      </View>
    </View>
  );
}
