// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { QuickNoteSection } from './QuickNoteSection';

// 막 쓰기는 카드 탭 맨 위에 붙어요(app/(tabs)/cards.tsx가 조립). 홈에는 두지 않아요.
export { QuickNoteSection };
export { QuickNoteInput } from './QuickNoteInput';
export { MemoLogScreen } from './MemoLogScreen';
export { TrashScreen } from './TrashScreen';

export const feature = defineFeature({
  id: 'notes',
  owner: 'A',
  // 메모 화면: 중요한 메모 + 막 쓰기 기록 (app/notes.tsx), 휴지통 (app/notes-trash.tsx)
  screens: [
    { route: 'notes', title: '메모' },
    { route: 'notes-trash', title: '휴지통' },
  ],
  lnb: [
    {
      section: 'quick',
      order: 10,
      label: '빠른 입력',
      icon: { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
      // 카드 탭을 열고 막 쓰기 칸에 바로 커서를 둬요.
      href: '/cards?focus=memo',
    },
    {
      section: 'quick',
      order: 11,
      label: '메모',
      icon: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
      href: '/notes',
    },
  ],
});
