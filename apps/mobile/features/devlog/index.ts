// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { DevlogSection } from './DevlogSection';

export { DevlogNewScreen } from './DevlogNewScreen';
export { DevlogScreen } from './DevlogScreen';
export { DevlogSection };

export const feature = defineFeature({
  id: 'devlog',
  owner: 'B',
  todaySection: { Component: DevlogSection, order: 50 },
  screens: [
    { route: 'devlog', title: '개발일지' },
    { route: 'devlog-new', title: '개발일지 쓰기', modal: true },
  ],
});
