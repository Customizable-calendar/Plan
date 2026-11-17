-- 파일(공용): 사진 같은 파일은 저장소(Storage)에, 여기에는 파일 키와 정보만 둬요.
-- 결정: docs/decisions/0003-file-storage.md. 앱 타입은 packages/shared/src/types/file.ts,
-- 변환은 packages/shared/src/db/mappers/files.ts, 저장소 호출은 packages/storage예요.

-- 사진 버킷. 공개하지 않고, 읽을 때마다 서명된 URL을 만들어요. 파일 하나는 10MB까지예요.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/webp', 'image/jpeg', 'image/png']);

-- 저장소 경로는 "<내 user id>/<파일 이름>" 모양이에요. 내 폴더 안에서만 올리고, 읽고, 지워요.
create policy "media 내 폴더만 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media 내 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media 내 폴더만 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create type public.files_status as enum ('pending', 'ready');

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 저장소 안의 경로. URL은 저장하지 않고 읽을 때마다 만들어요.
  key text not null unique,
  -- 목록에 보여 줄 작은 그림의 경로. 그림이 아니면 null
  thumbnail_key text,
  mime text not null,
  size bigint not null check (size >= 0),
  -- pending: 올리는 중, ready: 다 올라가서 쓸 수 있음
  status public.files_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- 다른 사람 폴더의 경로를 내 파일로 적지 못하게 해요.
  check (key like user_id::text || '/%'),
  check (thumbnail_key is null or thumbnail_key like user_id::text || '/%')
);

-- 내 사진함: 내 파일을 최근 것부터
create index files_user_created_idx on public.files (user_id, created_at desc);

alter table public.files enable row level security;

create policy "본인 파일만" on public.files
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 실시간: 폰에서 올린 사진이 다른 기기의 사진함에 바로 나타나게 해요. RLS가 본인 것만 보내요.
alter publication supabase_realtime add table public.files;
