// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { isTestBuild } from '@/features/cards';
import { defineFeature } from '@/lib/feature';

export { SttScreen } from './SttScreen';

// 편집기(A) 녹음 버튼 같은 데서 받아쓰기를 붙일 때 써요(README).
export { useDictation, type DictationState } from './useDictation';
export {
  discardLeftover,
  isSttAvailable,
  leftoverSeconds,
  startDictation,
  type SttResult,
  type SttSegment,
} from './engine';
export { SttError } from './errors';
export { isDownloaded, MODELS, type SttModel } from './models';

export const feature = defineFeature({
  id: 'stt',
  owner: 'B',
  // 편집기에 붙기 전까지 확인용 화면이라 개발·stage 빌드에서만 왼쪽 메뉴에 보여요.
  ...(isTestBuild
    ? {
        lnb: [
          {
            section: 'more' as const,
            order: 30,
            label: '받아쓰기',
            icon: { ios: 'mic', android: 'mic', web: 'mic' },
            href: '/stt',
          },
        ],
      }
    : {}),
  screens: [{ route: 'stt', title: '받아쓰기' }],
});
