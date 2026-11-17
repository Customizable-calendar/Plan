// files 행(snake_case) ↔ 앱 FileMeta(camelCase). (담당: D)
import type { FileMeta } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type FileRow = Tables<'files'>;
export type FileInsert = TablesInsert<'files'>;

export function toFileMeta(row: FileRow): FileMeta {
  const file: FileMeta = {
    id: row.id,
    key: row.key,
    mime: row.mime,
    size: row.size,
    status: row.status,
    // DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요.
    createdAt: new Date(row.created_at).toISOString(),
  };
  // 없는 값은 칸을 아예 만들지 않아요. 앱 타입에서 선택 항목(?)이라서요.
  if (row.thumbnail_key !== null) file.thumbnailKey = row.thumbnail_key;
  return file;
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toFileInsert(file: FileMeta): FileInsert {
  return {
    id: file.id,
    key: file.key,
    thumbnail_key: file.thumbnailKey ?? null,
    mime: file.mime,
    size: file.size,
    status: file.status,
    created_at: file.createdAt,
  };
}
