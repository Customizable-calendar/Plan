# db

DB 테이블 모양(자동 생성)과 앱 타입(`src/types/`)을 이어 주는 곳이에요.

| 파일                | 내용                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `database.types.ts` | `supabase gen types`로 만든 파일. 손으로 고치지 않아요. 첫 마이그레이션 때 생겨요 |
| `mappers/<영역>.ts` | DB 행(snake_case) ↔ 앱 타입(camelCase) 변환 함수                                  |

## 순서

1. 마이그레이션을 만들거나 고쳐요 (`supabase/migrations/README.md`).
2. 로컬 DB에 적용하고 타입을 다시 만들어요. Docker가 켜져 있어야 해요.
   ```bash
   npx supabase start      # 처음 한 번. 끌 때는 npx supabase stop
   npx supabase db reset   # 마이그레이션을 처음부터 다시 적용
   pnpm db:types
   ```
3. 바뀐 테이블의 mapper를 고쳐요. 컬럼이 없어지거나 이름이 바뀌면 여기서 타입 오류가 나요.
4. 마이그레이션, `database.types.ts`, mapper를 한 PR에 함께 올려요.

CI의 `db-types`가 마이그레이션으로 만든 DB와 `database.types.ts`가 같은지 검사해요. 다르면 2번을 다시 해요.

## mapper 예시

```ts
// mappers/cards.ts
import type { Tables, TablesInsert } from '../database.types';
import type { Card } from '../types';

type CardRow = Tables<'cards_cards'>;

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    dueAt: row.due_at ?? undefined,
    // … 앱 타입의 필드를 모두 채워요. 빠지면 tsc가 알려줘요.
  };
}

export function toCardInsert(card: Card, userId: string): TablesInsert<'cards_cards'> {
  return {
    id: card.id,
    user_id: userId,
    type: card.type,
    title: card.title,
    due_at: card.dueAt ?? null,
  };
}
```

mapper마다 예시 JSON으로 왕복 테스트(예시 JSON → `toCardInsert` → `toCard` 결과가 원래와 같은지)를 `test/`에 하나씩 둬요.
기능 코드는 Supabase 응답을 그대로 쓰지 않고 mapper를 거쳐 앱 타입으로 바꿔서 써요.
