// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { DevlogSection } from './DevlogSection';

export { DevlogNewScreen } from './DevlogNewScreen';
export { DevlogScreen } from './DevlogScreen';
export { DevlogSection };

// 공부 퀴즈(devquiz)가 일지와 같은 모양으로 쓰는 것들. 일지는 퀴즈를 몰라요(퀴즈만 지우면 돼요).
export { hasAiKey } from './ai';
export { AiMessage, AiText, ErrorNotice, Thinking, UserBubble } from './Chat';
export { look } from './look';
export { Markdown } from './Markdown';
export { type Member, memberOf, members, type Role } from './members';
export { type Devlog, useDevlogs } from './store';
export { shiftWeek, weekKey, weekLabel } from './week';

export const feature = defineFeature({
  id: 'devlog',
  owner: 'B',
  lnb: [
    {
      section: 'more',
      order: 10,
      label: '개발일지',
      icon: { ios: 'book', android: 'menu_book', web: 'menu_book' },
      href: '/devlog',
    },
  ],
  screens: [
    { route: 'devlog', title: '개발일지' },
    { route: 'devlog-new', title: '개발일지 쓰기', modal: true },
  ],
});
