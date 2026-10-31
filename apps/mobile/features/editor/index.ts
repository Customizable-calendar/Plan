// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { EditorScreen } from './EditorScreen';

export const feature = defineFeature({
  id: 'editor',
  owner: 'A',
  screens: [{ route: 'editor/[id]', title: '편집기' }],
});
