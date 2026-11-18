-- 받아쓰기 기록(B): 받아쓴 글, 문장 줄 시각, 화자, 녹음 중 북마크·메모. 녹음 노트 목록을 다시 열 수 있어요.
-- 메모처럼 기기에 먼저 저장하고 로그인하면 계정에도 올려요. 소리(녹음 원본 WAV)는 기기에만 있고 여기 없어요.
-- 앱 타입은 packages/shared/src/types/stt-note.ts, 변환은 packages/shared/src/db/mappers/stt.ts예요.

create table public.stt_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 앱이 만든 id(stt-note-<시각>)
  id text not null,
  title text not null check (char_length(title) <= 200),
  -- 받아쓴 글 전체(문장마다 줄을 나눈 글)
  text text not null default '',
  -- 받아쓴 덩어리 [{ text, startMs, endMs, speaker? }]
  segments jsonb not null default '[]' check (jsonb_typeof(segments) = 'array'),
  -- 녹음 중 북마크·메모 [{ ms, text? }]
  marks jsonb not null default '[]' check (jsonb_typeof(marks) = 'array'),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  -- 이 기기에 남긴 녹음 원본 id. 다른 기기에는 파일이 없어서 재생이 안 될 수 있어요.
  recording_id text,
  -- 받아쓴 모델(small, base, sensevoice)
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index stt_notes_created_idx on public.stt_notes (user_id, created_at desc);

alter table public.stt_notes enable row level security;

create policy "본인 받아쓰기 기록만" on public.stt_notes
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
