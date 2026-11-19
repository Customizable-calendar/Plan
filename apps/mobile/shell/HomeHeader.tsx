import { Icon, Text } from '@noteapp/ui';
import { router } from 'expo-router';
import { BellIcon, SearchIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { MenuButton } from './MenuButton';

// 홈 상단바: 메뉴 버튼, 오늘 날짜와 요일, 검색과 알림 아이콘. (디자인 시스템 redesign 홈)
export function HomeHeader() {
  const now = new Date();
  const label = now.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return (
    <View className="-mx-2 h-14 flex-row items-center">
      <MenuButton />
      <Text className="flex-1 pl-1 text-[15px] font-bold text-foreground">{label}</Text>
      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="button"
        accessibilityLabel="검색"
        className="h-11 w-11 items-center justify-center"
      >
        <Icon as={SearchIcon} size={22} className="text-foreground" />
      </Pressable>
      <Pressable
        onPress={() => router.push('/cards')}
        accessibilityRole="button"
        accessibilityLabel="확인할 카드"
        className="h-11 w-11 items-center justify-center"
      >
        <Icon as={BellIcon} size={22} className="text-foreground" />
      </Pressable>
    </View>
  );
}
