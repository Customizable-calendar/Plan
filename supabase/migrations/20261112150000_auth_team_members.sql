-- 팀원 명단과 팀원만 보는 개발일지·퀴즈 (담당: B, 로그인)
-- 레포가 공개라서 팀원 이메일은 여기 적지 않아요. stage 대시보드 SQL Editor에서 넣어요(docs/auth.md).

create table public.team_members (
  email text primary key check (email = lower(email)),
  role text not null unique check (role in ('A', 'B', 'C', 'D'))
);

-- 정책이 없어서 앱에서는 이 표를 직접 못 읽어요. 아래 함수로 내 역할만 알 수 있어요.
alter table public.team_members enable row level security;

/** 로그인한 계정이 팀원이면 'A'~'D', 아니면 null. 익명 계정은 늘 null이에요. */
create function public.my_team_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tm.role
  from public.team_members tm
  where tm.email = lower(auth.jwt() ->> 'email')
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

revoke execute on function public.my_team_role() from public, anon;
grant execute on function public.my_team_role() to authenticated;

-- 개발일지: 팀원만 읽고, 내 역할로만 써요.
drop policy "팀원 누구나 읽기" on public.devlog_devlogs;
drop policy "쓴 사람만 쓰기" on public.devlog_devlogs;
drop policy "쓴 사람만 고치기" on public.devlog_devlogs;

create policy "팀원만 읽기" on public.devlog_devlogs
  for select to authenticated using ((select public.my_team_role()) is not null);
create policy "내 역할로만 쓰기" on public.devlog_devlogs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and author = (select public.my_team_role()));
create policy "내 역할로만 고치기" on public.devlog_devlogs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and author = (select public.my_team_role()));

-- 퀴즈 결과: 팀원만 읽고, 내 역할로만 내요.
drop policy "팀원 누구나 읽기" on public.devquiz_results;
drop policy "푼 사람만 내기" on public.devquiz_results;

create policy "팀원만 읽기" on public.devquiz_results
  for select to authenticated using ((select public.my_team_role()) is not null);
create policy "내 역할로만 내기" on public.devquiz_results
  for insert to authenticated
  with check (user_id = (select auth.uid()) and author = (select public.my_team_role()));
