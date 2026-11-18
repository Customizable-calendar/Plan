-- 받아쓴 글에 쓰는 내 지시문(B): "회의록으로 정리", "할 일만 뽑기" 같은 것을 저장해 두고 다시 써요.
-- 지시문을 적용한 결과는 저장하지 않아요(화면에서 보고 공유해요). 받아쓴 글과 소리도 여기 없어요.
-- 앱 타입은 packages/shared/src/types/transform.ts, 변환은 packages/shared/src/db/mappers/stt.ts예요.

create table public.stt_transforms (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(stt-transform-<시각>)
  id text not null,
  -- 버튼에 보이는 이름
  title text not null check (char_length(btrim(title)) between 1 and 40),
  -- AI에 주는 지시문
  instructions text not null check (char_length(btrim(instructions)) between 1 and 4000),
  -- 목록 순서(작을수록 앞)
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.stt_transforms enable row level security;

create policy "본인 지시문만" on public.stt_transforms
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
