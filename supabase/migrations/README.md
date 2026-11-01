# migrations

DB 구조(테이블·RLS 정책)를 바꾸는 SQL 파일을 둬요. 새 파일은 `npx supabase migration new <영역>_<설명>`으로 만들어요.

- 이름: `<타임스탬프>_<영역>_<설명>.sql`. 예: `20261102120000_cards_create_cards.sql`
- 영역 접두사: `notes_`, `docs_`, `cards_`, `calendar_`, `exec_`, 공용 `profiles`, `files`
- 한 번 합친 파일은 고치지 않고, 바꿀 내용은 새 파일로 만들어요.
- 테이블을 만들면 같은 파일에서 RLS를 켜요.
- 고친 뒤에는 `npx supabase db reset && pnpm db:types`로 타입을 다시 만들어 같은 PR에 넣어요(`packages/shared/src/db/README.md`).
- stage DB에는 사람이 직접 적용하지 않아요. stage에 머지되면 GitHub Actions가 적용해요(`docs/deploy.md`).

```sql
alter table public.cards_cards enable row level security;

create policy "본인 카드만" on public.cards_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```
