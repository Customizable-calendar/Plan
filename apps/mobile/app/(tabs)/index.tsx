import { TodayEventsSection } from '@/features/calendar';
import { TodayCardsSection } from '@/features/cards';
import { QuickNoteSection } from '@/features/notes';
import { screen } from '@noteapp/ui';
import { ScrollView } from 'react-native';

// 오늘 화면은 여러 기능의 섹션을 모아서 보여주기만 해요. (조립: D, 섹션: A·B·C)
export default function TodayScreen() {
  return (
    <ScrollView style={screen.container} contentContainerStyle={screen.content}>
      <QuickNoteSection />
      <TodayEventsSection />
      <TodayCardsSection />
    </ScrollView>
  );
}
