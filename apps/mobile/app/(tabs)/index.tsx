import { ScrollView, Text, View } from 'react-native';

import { homeWidget, todaySections } from '@/features/registry';
import { HomeHeader } from '@/shell/HomeHeader';
import { QuickTools } from '@/shell/QuickTools';

// 홈은 주요 기능으로 바로 가는 위젯 자리예요. (조립: D)
// 자리 순서는 디자인 시스템 홈을 따라요: 헤더, AI 추천(banner), 오늘 일정(schedule), 최근 문서(recent).
// 각 자리는 기능 index.ts의 `homeWidget`이 채워요. 빠른 도구는 홈에서만 보여요.
// 위젯은 앱이 켜질 때 한 번만 찾아요(렌더할 때마다 찾지 않게).
const Banner = homeWidget('banner');
const Schedule = homeWidget('schedule');
const Recent = homeWidget('recent');

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-5 pb-40 pt-16">
        <HomeHeader />
        {Banner ? <Banner /> : null}
        {Schedule ? <Schedule /> : null}
        {Recent ? <Recent /> : null}
        {todaySections.length > 0 ? (
          <View className="gap-4">
            <Text className="text-xs text-muted-foreground">홈 위젯으로 옮기기 전 섹션</Text>
            {todaySections.map(({ id, Component }) => (
              <Component key={id} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <QuickTools />
    </View>
  );
}
