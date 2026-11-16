-- 수행 확인(C): 오늘 할 일을 실제로 했는지 기록해요. 앱 타입은 packages/shared/src/types/execution.ts,
-- 변환은 packages/shared/src/db/mappers/execution.ts예요.

create type public.exec_result as enum ('done', 'partial', 'not_done', 'unknown');

create table public.exec_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  card_id text not null,
  result public.exec_result not null,
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  memo text,
  recorded_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index exec_records_user_recorded_idx on public.exec_records (user_id, recorded_at desc);

alter table public.exec_records enable row level security;

create policy "본인 수행 기록만" on public.exec_records
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
