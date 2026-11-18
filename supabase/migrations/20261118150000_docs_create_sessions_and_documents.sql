-- 세션과 문서(A 기능, 테이블은 DB 담당 B). 메모처럼 기기에 먼저 저장하고 로그인하면 계정에도 올려요.
-- 앱 타입은 packages/shared/src/types/session.ts, document.ts, 변환은 packages/shared/src/db/mappers/docs.ts예요.
-- 양식(템플릿)은 앱에 들어 있는 JSON이라 테이블이 없어요(packages/shared/src/templates). template_id는 그 id예요.

-- 내 세션: 한 양식으로 계속 쌓아 가는 문서 묶음. template_id가 null이면 아직 양식을 안 고른 "미완성 세션"이에요.
create table public.docs_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(session-…)
  id text not null,
  template_id text,
  title text not null check (char_length(title) <= 200),
  -- 가장 최근에 쓴 문서 id. 문서를 지워도 세션은 남아서 외래 키로 묶지 않아요.
  last_document_id text,
  -- 막 쓰기 메모에서 만든 세션이면 그 메모 id와 원문(고치지 않고 그대로)
  source_note_id text,
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- 출처는 둘 다 있거나 둘 다 없어요.
  check ((source_note_id is null) = (source_text is null))
);

alter table public.docs_sessions enable row level security;

create policy "본인 세션만" on public.docs_sessions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 양식으로 만든 문서. 본문은 마크다운 글이에요.
create table public.docs_documents (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(draft-…, doc-…)
  id text not null,
  template_id text not null,
  title text not null check (char_length(title) <= 200),
  body text not null default '',
  -- 초안을 만들 때 쓴 카드 id(cards_cards.id). 카드를 지워도 문서는 남아서 배열로 둬요.
  card_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 세션 목록, 홈 최근 문서는 최근에 고친 순서로 봐요.
create index docs_documents_updated_idx on public.docs_documents (user_id, updated_at desc);

alter table public.docs_documents enable row level security;

create policy "본인 문서만" on public.docs_documents
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
