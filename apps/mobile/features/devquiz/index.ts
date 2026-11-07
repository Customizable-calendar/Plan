// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { DevquizSection } from './DevquizSection';

export { DevquizScreen } from './DevquizScreen';
export { DevquizSection };

// 개발 기간 이벤트라 개발 빌드(__DEV__)에서만 오늘 화면에 보여요. 출시 전에 이 기능은 지워요(README).
export const feature = defineFeature({
  id: 'devquiz',
  owner: 'B',
  ...(__DEV__ ? { todaySection: { Component: DevquizSection, order: 51 } } : {}),
  screens: [{ route: 'devquiz', title: '공부 퀴즈' }],
});
