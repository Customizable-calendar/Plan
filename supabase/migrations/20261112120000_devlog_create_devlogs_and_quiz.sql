-- 개발일지와 공부 퀴즈 결과 (담당: B). 개발 기간에만 쓰고 출시 전에 기능과 같이 지워요.
-- 팀원끼리 서로 읽고, 쓰기·고치기는 쓴 사람만 해요.
-- TODO(B): 로그인(D)과 profiles가 생기면 읽기를 팀원 계정으로 좁혀요. 지금은 로그인한 사람 누구나 읽어요.

create table public.devlog_devlogs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  author text not null check (author in ('A', 'B', 'C', 'D')),
  -- 그 주 월요일
  week date not null,
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  -- 한 주에 한 사람 한 편
  primary key (week, author)
);

alter table public.devlog_devlogs enable row level security;

create policy "팀원 누구나 읽기" on public.devlog_devlogs
  for select to authenticated using (true);
create policy "쓴 사람만 쓰기" on public.devlog_devlogs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "쓴 사람만 고치기" on public.devlog_devlogs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "쓴 사람만 지우기" on public.devlog_devlogs
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.devquiz_results (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  author text not null check (author in ('A', 'B', 'C', 'D')),
  week date not null,
  score smallint not null check (score between 0 and 100),
  comment text not null default '' check (char_length(comment) <= 2000),
  -- [{question, answer, score(0~20), feedback}]
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  created_at timestamptz not null default now(),
  -- 한 사람이 한 주에 한 번, 첫 시도만
  primary key (week, author)
);

alter table public.devquiz_results enable row level security;

create policy "팀원 누구나 읽기" on public.devquiz_results
  for select to authenticated using (true);
-- 고치기·지우기 정책이 없어서 한 번 낸 결과는 못 바꿔요.
create policy "푼 사람만 내기" on public.devquiz_results
  for insert to authenticated with check (user_id = (select auth.uid()));
