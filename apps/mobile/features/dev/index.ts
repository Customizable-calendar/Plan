// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { DevMenuScreen } from './DevMenuScreen';

export const feature = defineFeature({
  id: 'dev',
  owner: 'D',
  screens: [{ route: 'dev', title: '개발 메뉴' }],
  // 개발 빌드에서만 왼쪽 메뉴 기타에 보여요.
  ...(__DEV__
    ? {
        lnb: [
          {
            section: 'more' as const,
            order: 99,
            label: '개발 메뉴',
            icon: { ios: 'hammer', android: 'build', web: 'build' },
            href: '/dev',
          },
        ],
      }
    : {}),
});
