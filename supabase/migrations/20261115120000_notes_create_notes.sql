-- 메모(A): 사용자가 막 쓴 원문. 앱 타입은 packages/shared/src/types/note.ts,
-- 변환은 packages/shared/src/db/mappers/notes.ts예요.

create table public.notes_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(note-<시각>)를 그대로 써요. 카드의 source_note_id가 이 값을 가리켜요.
  -- 사람마다 따로라 (user_id, id)로 구분해요.
  id text not null,
  -- 원문은 고치지 않아요. 앞뒤 공백만 지운 글이에요.
  text text not null check (length(text) between 1 and 20000),
  -- 리마인드: 시각은 UTC, 시간대(IANA, 예: Asia/Seoul)는 따로. 둘은 같이 있거나 같이 없어요.
  reminder_at timestamptz,
  reminder_time_zone text,
  -- 함께 보는 사람의 이메일. 지금은 적어 두기만 하고, 그 사람에게 보여 주지는 않아요.
  collaborators text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check ((reminder_at is null) = (reminder_time_zone is null))
);

-- 메모 화면: 내 메모를 최근 것부터
create index notes_notes_user_created_idx on public.notes_notes (user_id, created_at desc);

alter table public.notes_notes enable row level security;

create policy "본인 메모만" on public.notes_notes
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
