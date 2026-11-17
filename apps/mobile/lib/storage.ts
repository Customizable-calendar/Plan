import { createSupabaseStorage, type FileStorage } from '@noteapp/storage';

import { getSupabase } from './supabase';

// 앱에서 파일을 올리고 내려받을 때는 여기서 받은 FileStorage만 써요. (담당: D)
// 지금은 Supabase Storage예요. S3로 옮기면 이 파일에서 어댑터만 바꿔요. (docs/decisions/0003-file-storage.md)

/** 사진을 두는 버킷. 경로는 "<내 user id>/<파일 이름>" 모양이에요. */
export const MEDIA_BUCKET = 'media';

let storage: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (!storage) storage = createSupabaseStorage(getSupabase(), MEDIA_BUCKET);
  return storage;
}
