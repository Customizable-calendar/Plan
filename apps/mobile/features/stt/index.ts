// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { SttScreen } from './SttScreen';

// 편집기(A) 녹음 버튼 같은 데서 받아쓰기를 붙일 때 써요(README).
export { useDictation, type DictationState } from './useDictation';
export { isSttAvailable, startDictation, type SttResult, type SttSegment } from './engine';
export { SttError } from './errors';
export { isDownloaded, MODELS, type SttModel } from './models';

export const feature = defineFeature({
  id: 'stt',
  owner: 'B',
  screens: [{ route: 'stt', title: '받아쓰기' }],
});
