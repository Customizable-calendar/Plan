// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

export { FeedScreen } from './FeedScreen';

export const feature = defineFeature({
  id: 'feed',
  owner: 'D',
  tab: { title: '피드', icon: { ios: 'person.2', android: 'group', web: 'group' }, order: 40 },
});
