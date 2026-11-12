-- 카드(B): 메모에서 나눈 정보 한 장. 앱 타입은 packages/shared/src/types/card.ts,
-- 변환은 packages/shared/src/db/mappers/cards.ts예요.

create type public.cards_card_type as enum ('event', 'task', 'person', 'idea');
create type public.cards_card_status as enum ('suggested', 'confirmed', 'dismissed');

create table public.cards_cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 추출기가 만든 id(<noteId>:<type>:<시작 위치>)를 그대로 써요. 사람마다 따로라 (user_id, id)로 구분해요.
  id text not null,
  type public.cards_card_type not null,
  status public.cards_card_status not null default 'suggested',
  title text not null check (length(title) between 1 and 200),
  -- 시각은 UTC로 저장해요. 시간대는 사용자 설정에 따로 둬요(docs/conventions.md).
  start_at timestamptz,
  end_at timestamptz,
  due_at timestamptz,
  -- 사람 카드: 원문에 적힌 이름 그대로
  person_name text,
  -- 카드가 나온 메모와 [시작, 끝) 글자 위치. 메모 테이블(notes_, A)이 생기면 외래 키를 걸어요.
  source_note_id text not null,
  source_start integer not null check (source_start >= 0),
  source_end integer not null check (source_end > source_start),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (start_at is null or end_at is null or end_at >= start_at)
);

-- 카드 탭: 내 카드를 최근 것부터
create index cards_cards_user_created_idx on public.cards_cards (user_id, created_at desc);

alter table public.cards_cards enable row level security;

create policy "본인 카드만" on public.cards_cards
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
