import { Text, View } from 'react-native';

import { MenuButton } from './MenuButton';

// 홈 맨 위: 메뉴 버튼, 요일, 큰 날짜. 기기 시간대로 보여줘요.
export function HomeHeader() {
  const now = new Date();
  const weekday = now.toLocaleDateString('ko-KR', { weekday: 'long' });
  const date = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  return (
    <View className="gap-2">
      <MenuButton className="-ml-2" />
      <View>
        <Text className="text-sm text-muted-foreground">{weekday}</Text>
        <Text className="text-[28px] font-bold tracking-tight text-foreground">{date}</Text>
      </View>
    </View>
  );
}
