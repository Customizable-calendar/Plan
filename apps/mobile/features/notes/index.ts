// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { QuickNoteSection } from './QuickNoteSection';

// 막 쓰기는 카드 탭 맨 위에 붙어요(app/(tabs)/cards.tsx가 조립). 홈에는 두지 않아요.
export { QuickNoteSection };

export const feature = defineFeature({
  id: 'notes',
  owner: 'A',
  lnb: [
    {
      section: 'quick',
      order: 10,
      label: '빠른 입력',
      icon: { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
      // 카드 탭을 열고 막 쓰기 칸에 바로 커서를 둬요.
      href: '/cards?focus=memo',
    },
  ],
});
