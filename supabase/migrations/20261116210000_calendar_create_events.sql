-- 캘린더(C): 외부(Google 등) 캘린더에서 가져온 일정. 앱 타입은 packages/shared/src/types/calendar.ts,
-- 변환은 packages/shared/src/db/mappers/calendar.ts예요.

create type public.calendar_event_source as enum ('google');

create table public.calendar_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  calendar_id text not null,
  title text not null check (length(title) between 1 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null,
  source public.calendar_event_source not null default 'google',
  primary key (user_id, id),
  check (end_at >= start_at)
);

create index calendar_events_user_start_idx on public.calendar_events (user_id, start_at asc);

alter table public.calendar_events enable row level security;

create policy "본인 일정만" on public.calendar_events
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
