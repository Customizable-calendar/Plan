import type { FileStorage } from '../index';

// 이 패키지는 supabase-js에 기대지 않아요. 저장소 호출에 필요한 모양만 적어 두고,
// 앱이 자기 Supabase 클라이언트를 넘겨요. (나중에 S3 어댑터로 바꿔 끼우기 쉽게요)
interface StorageError {
  message: string;
}

interface BucketApi {
  createSignedUploadUrl(
    path: string,
  ): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>;
  remove(paths: string[]): Promise<{ error: StorageError | null }>;
}

export interface SupabaseStorageClient {
  storage: { from(bucket: string): BucketApi };
}

/** 내려받기 URL이 살아 있는 시간(초). 따로 안 정하면 한 시간이에요. */
const DEFAULT_EXPIRES = 60 * 60;

/**
 * Supabase Storage 어댑터.
 * 나중에 S3로 옮길 때는 adapters/s3.ts를 같은 모양으로 추가하고 환경 변수만 바꿔요.
 */
export function createSupabaseStorage(client: SupabaseStorageClient, bucket: string): FileStorage {
  const files = () => client.storage.from(bucket);
  const fail = (what: string, error: StorageError | null): never => {
    throw new Error(`저장소(${bucket})에서 ${what} 못했어요. ${error?.message ?? ''}`.trim());
  };

  return {
    // mime은 URL을 만들 때는 쓰지 않아요. 올릴 때 Content-Type으로 보내요 (uploadFile).
    async createUploadUrl(key) {
      const { data, error } = await files().createSignedUploadUrl(key);
      if (error || !data) return fail('올릴 주소를 만들지', error);
      return { key, url: data.signedUrl };
    },
    async createDownloadUrl(key, expiresInSeconds = DEFAULT_EXPIRES) {
      const { data, error } = await files().createSignedUrl(key, expiresInSeconds);
      if (error || !data) return fail('내려받을 주소를 만들지', error);
      return data.signedUrl;
    },
    async remove(key) {
      const { error } = await files().remove([key]);
      if (error) fail('파일을 지우지', error);
    },
  };
}
