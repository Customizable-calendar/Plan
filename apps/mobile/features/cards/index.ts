// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { TodayCardsSection } from './TodayCardsSection';

export { CardsScreen } from './CardsScreen';
export { TodayCardsSection };

export const feature = defineFeature({
  id: 'cards',
  owner: 'B',
  tab: {
    title: '카드',
    icon: { ios: 'rectangle.stack', android: 'style', web: 'style' },
    order: 20,
  },
  todaySection: { Component: TodayCardsSection, order: 30 },
});
