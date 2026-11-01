// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { SettingsScreen } from './SettingsScreen';

export const feature = defineFeature({
  id: 'settings',
  owner: 'D',
  screens: [{ route: 'settings', title: '설정' }],
});
