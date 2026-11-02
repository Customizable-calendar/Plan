import { type Card, fixtures } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

// 카드 데이터는 여기서만 가져오고 저장해요. 화면은 store.ts를 거쳐요.
// M2: dataSource === 'supabase'면 cards_ 테이블 + mapper로 바꿔요. 화면·store는 그대로예요.

export async function listCards(): Promise<Card[]> {
  if (dataSource === 'fixtures') return fromFixture(fixtures.cards);
  throw new Error('cards: Supabase 연결은 M2에서 만들어요.');
}

/** 확인·고치기·버리기 결과를 저장해요. M1은 앱이 켜져 있는 동안만 기억해요. */
export async function saveCard(card: Card): Promise<void> {
  if (dataSource === 'fixtures') return;
  void card;
  throw new Error('cards: Supabase 연결은 M2에서 만들어요.');
}

/** 카드가 나온 메모 원문. M2에는 메모(A)의 index.ts에서 내보낸 함수로 바꿔요. */
export async function getNoteText(noteId: string): Promise<string | undefined> {
  if (dataSource === 'fixtures') return fixtures.notes.find((n) => n.id === noteId)?.text;
  throw new Error('cards: Supabase 연결은 M2에서 만들어요.');
}
