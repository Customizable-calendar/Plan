import type { FileStorage } from '../index';

/**
 * Supabase Storage 어댑터. 아직 뼈대예요.
 * TODO(D, M2): 버킷을 만들고 createSignedUploadUrl / createSignedUrl / remove로 구현
 * 나중에 S3로 옮길 때는 adapters/s3.ts를 같은 모양으로 추가하고 환경 변수만 바꿔요.
 */
export function createSupabaseStorage(bucket: string): FileStorage {
  const notYet = () => new Error(`Supabase Storage(${bucket}) 어댑터는 아직 구현 전이에요.`);
  return {
    async createUploadUrl() {
      throw notYet();
    },
    async createDownloadUrl() {
      throw notYet();
    },
    async remove() {
      throw notYet();
    },
  };
}
