// stt_transforms 행(snake_case) ↔ 앱 SttTransform(camelCase). (담당: B)
import type { SttTransform } from '../../types';
import type { Tables, TablesInsert } from '../database.types';

export type SttTransformRow = Tables<'stt_transforms'>;
export type SttTransformInsert = TablesInsert<'stt_transforms'>;

/** DB는 +00:00으로 돌려줘요. 앱 약속(ISO 8601, UTC, Z)에 맞춰요. */
const iso = (value: string) => new Date(value).toISOString();

export function toSttTransform(row: SttTransformRow): SttTransform {
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    order: row.sort_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** user_id는 DB가 auth.uid()로 채워요. RLS가 본인 것만 넣게 막아요. */
export function toSttTransformInsert(transform: SttTransform): SttTransformInsert {
  return {
    id: transform.id,
    title: transform.title,
    instructions: transform.instructions,
    sort_order: transform.order,
    created_at: transform.createdAt,
    updated_at: transform.updatedAt,
  };
}
