// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { ExecutionScreen } from './ExecutionScreen';

export const feature = defineFeature({
  id: 'execution',
  owner: 'C',
  screens: [{ route: 'execution', title: '오늘 한 일 확인', modal: true }],
});
