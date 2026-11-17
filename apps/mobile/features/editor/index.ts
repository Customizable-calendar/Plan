// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { EditorScreen } from './EditorScreen';
// 세션 목록이 "이번에 쓴 문서"를 함께 보여줄 때 써요.
export { listEditedDocuments } from './data';

export const feature = defineFeature({
  id: 'editor',
  owner: 'A',
  screens: [{ route: 'editor/[id]', title: '편집기' }],
});
