import { cardHints, extractCards } from '@noteapp/extractor';
import { type Card, type CardRow, fixtures, toCard, toCardInsert } from '@noteapp/shared';

import { fromFixture, sourceFor } from '@/lib/data-source';

import { failed, signedIn } from './session';

// 카드 데이터는 여기서만 가져오고 저장해요. 화면은 store.ts를 거쳐요.
// fixtures: 예시 JSON, 앱이 켜져 있는 동안만 기억해요.
// supabase: cards_cards 테이블(RLS로 본인 카드만). 행은 mapper(@noteapp/shared)로 바꿔요.

// TODO(B, M2): 사용자 설정의 시간대로 바꿔요. (format.ts와 같이)
const timezone = 'Asia/Seoul';

const TABLE = 'cards_cards';
const dataSource = sourceFor('cards');

export async function listCards(): Promise<Card[]> {
  if (dataSource === 'fixtures') return fromFixture(fixtures.cards);
  const supabase = await signedIn();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) failed('카드를 불러오지', error);
  return (data as CardRow[]).map(toCard);
}

/** 확인·고치기·버리기 결과나 새로 찾은 카드를 저장해요. 같은 카드면 덮어써요. */
export async function saveCards(list: Card[]): Promise<void> {
  if (dataSource === 'fixtures' || list.length === 0) return;
  const supabase = await signedIn();
  // user_id는 DB가 auth.uid()로 채워요.
  const { error } = await supabase
    .from(TABLE)
    .upsert(list.map(toCardInsert), { onConflict: 'user_id,id' });
  if (error) failed('카드를 저장하지', error);
}

export const saveCard = (card: Card) => saveCards([card]);

// "메모로 카드 만들기"로 넣어 본 메모. M2에는 메모(A)가 저장하고, 여기서는 noteId만 받아요.
const tried = new Map<string, string>();

/** 메모 원문으로 카드 후보를 만들어요. 규칙 추출기(@noteapp/extractor)를 기기에서 바로 돌려요. */
export async function extractFromText(
  text: string,
  options: { spoken?: boolean } = {},
): Promise<Card[]> {
  const now = new Date();
  const note = { id: `try-${now.getTime()}`, text, createdAt: now.toISOString() };
  tried.set(note.id, text);
  // spoken: 받아쓴 말(회의록). 마침표 없이도 말끝으로 나누고 지난 일은 빼요.
  return extractCards(note, { now, timezone, spoken: options.spoken });
}

/** 카드가 나온 메모 원문. M2에는 메모(A)의 index.ts에서 내보낸 함수로 바꿔요. */
export async function getNoteText(noteId: string): Promise<string | undefined> {
  if (tried.has(noteId)) return tried.get(noteId);
  if (dataSource === 'fixtures') return fixtures.notes.find((n) => n.id === noteId)?.text;
  // TODO(B, M2): 메모(A) 테이블이 생기면 notes의 index.ts에서 원문을 가져와요. 그때까지는 원문 안내만 빠져요.
  return undefined;
}

/** 파서가 짐작한 부분 안내 ("오전·오후가 없어서 오후로 봤어요"). 확인 전 일정·할 일 카드만 */
export async function getHints(card: Card): Promise<string[]> {
  if (card.status !== 'suggested') return [];
  const text = await getNoteText(card.source.noteId);
  return text ? cardHints(card, text, timezone) : [];
}
