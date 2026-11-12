// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { isTestBuild } from '@/features/cards';
import { defineFeature } from '@/lib/feature';

import { DevquizSection } from './DevquizSection';

export { DevquizScreen } from './DevquizScreen';
export { DevquizSection };

// 개발 기간 이벤트라 개발·stage 빌드에서만 왼쪽 메뉴에 보여요. 출시 전에 이 기능은 지워요(README).
export const feature = defineFeature({
  id: 'devquiz',
  owner: 'B',
  ...(isTestBuild
    ? {
        lnb: [
          {
            section: 'more' as const,
            order: 20,
            label: '공부 퀴즈',
            icon: { ios: 'questionmark.circle', android: 'quiz', web: 'quiz' },
            href: '/devquiz',
          },
        ],
      }
    : {}),
  screens: [{ route: 'devquiz', title: '공부 퀴즈' }],
});
