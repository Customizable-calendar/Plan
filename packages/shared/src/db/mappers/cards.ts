// cards_cards 행(snake_case) ↔ 앱 Card(camelCase). (담당: B)
import type { Card } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type CardRow = Tables<'cards_cards'>;
export type CardInsert = TablesInsert<'cards_cards'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();
const isoOrUndefined = (value: string | null) => (value === null ? undefined : iso(value));

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    startAt: isoOrUndefined(row.start_at),
    endAt: isoOrUndefined(row.end_at),
    dueAt: isoOrUndefined(row.due_at),
    personName: row.person_name ?? undefined,
    source: {
      kind: 'note',
      noteId: row.source_note_id,
      span: [row.source_start, row.source_end],
    },
    createdAt: iso(row.created_at),
  };
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toCardInsert(card: Card): CardInsert {
  return {
    id: card.id,
    type: card.type,
    status: card.status,
    title: card.title,
    start_at: card.startAt ?? null,
    end_at: card.endAt ?? null,
    due_at: card.dueAt ?? null,
    person_name: card.personName ?? null,
    source_note_id: card.source.noteId,
    source_start: card.source.span[0],
    source_end: card.source.span[1],
    created_at: card.createdAt,
  };
}
