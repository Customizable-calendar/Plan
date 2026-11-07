import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useCards } from './store';

// 홈 AI 추천 자리(banner). 확인 대기 카드 수를 알려 주고 초안 만들기로 보내요.
// 숫자는 실제 카드에서만 세요. 없는 수치를 지어내지 않아요.
export function HomeBanner() {
  const { cards, loading } = useCards();
  const waiting = cards.filter((c) => c.status === 'suggested').length;
  const confirmed = cards.filter((c) => c.status === 'confirmed').length;

  const message = loading
    ? '카드를 불러오는 중이에요.'
    : waiting > 0
      ? `확인할 카드가 ${waiting}장 있어요.\n확인하고 업무일지 초안을 만들어 볼까요?`
      : confirmed > 0
        ? `확인한 카드 ${confirmed}장으로\n업무일지 초안을 만들어 볼까요?`
        : '메모를 쓰면 카드로 나눠 드려요.';

  return (
    <View className="gap-3 rounded-xl bg-primary-soft p-5">
      <Text className="text-[13px] font-bold text-ai">AI 추천</Text>
      <Text className="text-[17px] font-bold leading-7 text-foreground">{message}</Text>
      <View className="flex-row gap-2">
        {waiting > 0 ? (
          <Pressable
            onPress={() => router.push('/cards')}
            accessibilityRole="button"
            className="h-10 justify-center rounded-md border border-primary px-4"
          >
            <Text className="text-sm font-semibold text-primary">카드 확인</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/draft')}
          accessibilityRole="button"
          className="h-10 justify-center rounded-md bg-primary px-4"
        >
          <Text className="text-sm font-semibold text-primary-foreground">초안 만들기</Text>
        </Pressable>
      </View>
    </View>
  );
}
