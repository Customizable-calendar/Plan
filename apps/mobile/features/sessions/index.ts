// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { SessionsSection } from './SessionsSection';

export { SessionsScreen } from './SessionsScreen';

export const feature = defineFeature({
  id: 'sessions',
  owner: 'A',
  screens: [{ route: 'sessions', title: '세션' }],
  // 오늘 화면에서 세션 화면으로 들어가는 입구
  todaySection: { Component: SessionsSection, order: 40 },
});
