// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { HomeBanner } from './HomeBanner';
import { useEventCount, useIdeaCount, usePersonCount, useTaskCount, useWaitingCount } from './lnb';

export { CardsScreen } from './CardsScreen';
export { TodayCardsSection } from './TodayCardsSection';
// AI 초안(같은 B)이 확인한 카드를 고를 때 써요.
export { useCards } from './store';
export { cardDetail, typeLabel } from './format';
// 카드 탭 맨 위 막 쓰기(notes)가 저장한 글을 카드로 나눌 때 써요.
export { findCardsFromMemo } from './lnb';

const cardsIcon = { ios: 'rectangle.stack', android: 'style', web: 'style' } as const;

export const feature = defineFeature({
  id: 'cards',
  owner: 'B',
  tab: { title: '카드', icon: cardsIcon, order: 20 },
  homeWidget: { slot: 'banner', Component: HomeBanner },
  lnb: [
    {
      section: 'cards',
      order: 10,
      label: '확인 대기',
      icon: { ios: 'tray', android: 'inbox', web: 'inbox' },
      href: '/cards',
      useCount: useWaitingCount,
      emphasis: true,
    },
    {
      section: 'cards',
      order: 20,
      label: '일정',
      icon: { ios: 'calendar', android: 'event', web: 'event' },
      href: '/cards',
      useCount: useEventCount,
    },
    {
      section: 'cards',
      order: 30,
      label: '할 일',
      icon: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
      href: '/cards',
      useCount: useTaskCount,
    },
    {
      section: 'cards',
      order: 40,
      label: '사람',
      icon: { ios: 'person', android: 'person', web: 'person' },
      href: '/cards',
      useCount: usePersonCount,
    },
    {
      section: 'cards',
      order: 50,
      label: '아이디어',
      icon: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
      href: '/cards',
      useCount: useIdeaCount,
    },
  ],
});
