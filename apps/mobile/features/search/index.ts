// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { SearchScreen } from './SearchScreen';

export const feature = defineFeature({
  id: 'search',
  owner: 'D',
  tab: {
    title: '검색',
    icon: { ios: 'magnifyingglass', android: 'search', web: 'search' },
    order: 50,
  },
});
