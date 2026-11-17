-- 해시태그 카테고리: 같은 카테고리로 지정한 해시태그를 묶어 둬요. 메모·일정이 같이 써요.
-- 화면(연결망에서 묶어 보기 등)은 C, 테이블은 DB 담당(B)이에요.
-- 앱 타입은 packages/shared/src/types/tag.ts, 변환은 packages/shared/src/db/mappers/tags.ts예요.

create table public.tags_categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(tag-category-<시각>)
  id text not null,
  -- 카테고리 이름. 예: 개발, 운동
  name text not null check (char_length(btrim(name)) between 1 and 30),
  -- 디자인 시스템 색 이름이나 #RRGGBB. 없으면 앱이 정해요.
  color text check (color is null or char_length(color) <= 32),
  -- 이 카테고리에 넣은 해시태그(#포함, 공백 없음). 해시태그 하나는 카테고리 하나에만 넣어요(앱이 지켜요).
  tags text[] not null default '{}'
    check (array_to_string(tags, ' ') ~ '^(#[^[:space:]#]+( |$))*$'),
  -- 목록 순서(작을수록 위)
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- "이 해시태그는 어느 카테고리?"를 빨리 찾아요.
create index tags_categories_tags_idx on public.tags_categories using gin (tags);

alter table public.tags_categories enable row level security;

create policy "본인 해시태그 카테고리만" on public.tags_categories
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
