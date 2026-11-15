-- 메모(A): 기기 저장소에 있던 해시태그, 중요 표시, 휴지통, 체크리스트를 테이블로 옮겨요.
-- 앱 타입은 packages/shared/src/types/note.ts, 변환은 packages/shared/src/db/mappers/notes.ts예요.

-- 기록에서 빠진 메모가 어디로 갔는지
create type public.notes_moved_to as enum ('checklist', 'session');

alter table public.notes_notes
  -- 사용자가 고른 해시태그(#포함). 원문(text)은 고치지 않고 여기에 따로 둬요.
  add column tags text[] not null default '{}',
  -- 별을 누른 시각. null이면 중요한 메모가 아니에요.
  add column important_at timestamptz,
  -- 휴지통에 넣은 시각. null이면 휴지통에 없어요. 완전히 지우면 행이 없어져요.
  add column trashed_at timestamptz,
  -- 체크리스트나 세션으로 옮겨서 기록에서 뺀 메모. 원문은 그대로 남겨요.
  add column moved_to public.notes_moved_to;

-- 메모에서 만든 체크리스트. 막 쓰기 아래에 보여요.
create table public.notes_checklists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(checklist-<시각>)
  id text not null,
  -- 어느 메모에서 왔는지. 메모를 완전히 지우면 체크리스트도 같이 지워져요.
  note_id text not null,
  -- 항목 목록: [{ "text": "할 일", "checked": false }]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, note_id) references public.notes_notes (user_id, id) on delete cascade
);

-- 막 쓰기 아래: 내 체크리스트를 최근 것부터
create index notes_checklists_user_created_idx
  on public.notes_checklists (user_id, created_at desc);

alter table public.notes_checklists enable row level security;

create policy "본인 체크리스트만" on public.notes_checklists
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
