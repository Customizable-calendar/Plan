import { useLocalSearchParams } from 'expo-router';

import { CardsScreen, findCardsFromMemo } from '@/features/cards';
import { QuickNoteSection } from '@/features/notes';

// 카드 탭: 맨 위에 막 쓰기(notes, A)를 두고, 저장하면 카드 찾기(cards, B)로 이어요. 조립만 해요.
export default function CardsTab() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  return (
    <CardsScreen
      memo={
        <QuickNoteSection
          onSaved={findCardsFromMemo}
          showRecent={false}
          autoFocus={focus === 'memo'}
        />
      }
    />
  );
}
