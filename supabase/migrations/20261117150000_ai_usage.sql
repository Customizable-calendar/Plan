-- 팀 AI 키 사용량(B): Edge Function `ai`가 팀 키로 Claude를 부를 때마다 사람별·날짜별로 세요.
-- 하루 한도를 넘으면 함수가 막아요. 앱에서는 이 표를 읽거나 쓰지 않아요(정책 없음, 함수만 service role로 써요).
-- 요청 원문과 답은 저장하지 않아요. 횟수와 토큰 수만 남겨요.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 한국 날짜 기준
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  requests integer not null default 0 check (requests >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

/**
 * 오늘 요청을 하나 세고, 한도 안이면 true를 돌려줘요. 동시에 불려도 정확히 세요.
 * 한도를 넘으면 세지 않고 false예요.
 */
create function public.ai_take_request(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  insert into public.ai_usage (user_id, day, requests)
  values (p_user, v_day, 1)
  on conflict (user_id, day) do update
    set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_limit
  returning requests into v_count;
  return v_count is not null;
end;
$$;

/** 답을 받은 뒤 토큰 수를 더해요. */
create function public.ai_add_tokens(p_user uuid, p_input bigint, p_output bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set input_tokens = input_tokens + greatest(p_input, 0),
      output_tokens = output_tokens + greatest(p_output, 0)
  where user_id = p_user and day = (now() at time zone 'Asia/Seoul')::date
$$;

-- 함수(service role)만 불러요. 앱(anon, authenticated)은 못 불러요.
revoke execute on function public.ai_take_request(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ai_add_tokens(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ai_take_request(uuid, integer) to service_role;
grant execute on function public.ai_add_tokens(uuid, bigint, bigint) to service_role;
