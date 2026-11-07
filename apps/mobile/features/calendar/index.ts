// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { TodayEventsSection } from './TodayEventsSection';

export { CalendarScreen } from './CalendarScreen';
export { TodayEventsSection };
export { listCalendarTasks } from './data';
export { CalendarButton, useCalendarTheme } from './design';
export { dayKey, timeLabel } from './model';

// 캘린더는 하단 탭이 아니라 왼쪽 메뉴 빠른 실행과 홈 「전체 보기」로 들어가요.
export const feature = defineFeature({
  id: 'calendar',
  owner: 'C',
  screens: [{ route: 'calendar', title: '캘린더' }],
  todaySection: { Component: TodayEventsSection, order: 20 },
  lnb: [
    {
      section: 'quick',
      order: 20,
      label: '캘린더',
      icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
      href: '/calendar',
    },
  ],
});
