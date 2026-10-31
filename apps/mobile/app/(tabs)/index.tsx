import { screen } from '@noteapp/ui';
import { ScrollView } from 'react-native';

import { todaySections } from '@/features/registry';

// 오늘 화면은 각 기능 index.ts의 `todaySection`을 순서대로 모아서 보여줘요. (조립: D)
export default function TodayScreen() {
  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      {todaySections.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </ScrollView>
  );
}
