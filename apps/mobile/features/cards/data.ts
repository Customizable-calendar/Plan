import { extractCards } from '@noteapp/extractor';
import { type Card, fixtures } from '@noteapp/shared';

import { dataSource, fromFixture } from '@/lib/data-source';

// 카드 데이터는 여기서만 가져오고 저장해요. 화면은 store.ts를 거쳐요.
// M2: dataSource === 'supabase'면 cards_ 테이블 + mapper로 바꿔요. 화면·store는 그대로예요.

// TODO(B, M2): 사용자 설정의 시간대로 바꿔요. (format.ts와 같이)
const timezone = 'Asia/Seoul';

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

// "메모로 카드 만들기"로 넣어 본 메모. M2에는 메모(A)가 저장하고, 여기서는 noteId만 받아요.
const tried = new Map<string, string>();

/** 메모 원문으로 카드 후보를 만들어요. 규칙 추출기(@noteapp/extractor)를 기기에서 바로 돌려요. */
export async function extractFromText(text: string): Promise<Card[]> {
  const now = new Date();
  const note = { id: `try-${now.getTime()}`, text, createdAt: now.toISOString() };
  tried.set(note.id, text);
  return extractCards(note, { now, timezone });
}

/** 카드가 나온 메모 원문. M2에는 메모(A)의 index.ts에서 내보낸 함수로 바꿔요. */
export async function getNoteText(noteId: string): Promise<string | undefined> {
  if (tried.has(noteId)) return tried.get(noteId);
  if (dataSource === 'fixtures') return fixtures.notes.find((n) => n.id === noteId)?.text;
  throw new Error('cards: Supabase 연결은 M2에서 만들어요.');
}
