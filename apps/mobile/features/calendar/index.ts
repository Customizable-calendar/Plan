// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { TodayEventsSection } from './TodayEventsSection';

export { CalendarScreen } from './CalendarScreen';
export { TodayEventsSection };

export const feature = defineFeature({
  id: 'calendar',
  owner: 'C',
  tab: {
    title: '캘린더',
    icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    order: 30,
  },
  todaySection: { Component: TodayEventsSection, order: 20 },
});
