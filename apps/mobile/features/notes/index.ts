// 이 기능이 밖으로 내보내는 것만 적어요. `feature`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

import { QuickNoteSection } from './QuickNoteSection';

export { QuickNoteSection };

export const feature = defineFeature({
  id: 'notes',
  owner: 'A',
  todaySection: { Component: QuickNoteSection, order: 10 },
});
