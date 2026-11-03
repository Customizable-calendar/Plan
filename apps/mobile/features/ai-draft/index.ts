// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { DraftScreen } from './DraftScreen';

export const feature = defineFeature({
  id: 'ai-draft',
  owner: 'B',
  screens: [{ route: 'draft', title: 'AI 초안', modal: true }],
});
