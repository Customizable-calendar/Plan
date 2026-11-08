// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { LnbSessions } from './LnbSessions';
import { RecentDocs } from './RecentDocs';

export { SessionsScreen } from './SessionsScreen';

// 세션은 왼쪽 메뉴 세션 섹션에서, 최근 문서는 홈에서 들어가요.
export const feature = defineFeature({
  id: 'sessions',
  owner: 'A',
  screens: [{ route: 'sessions', title: '세션' }],
  homeWidget: { slot: 'recent', Component: RecentDocs },
  lnb: [{ section: 'sessions', order: 10, Component: LnbSessions }],
});
