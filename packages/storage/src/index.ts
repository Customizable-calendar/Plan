export type StorageProvider = 'supabase' | 's3';

export interface UploadTarget {
  /** 저장소 안의 경로. DB에는 이 값만 저장해요. */
  key: string;
  /** 앱이 파일을 직접 올릴 서명된 URL */
  url: string;
}

export interface FileStorage {
  createUploadUrl(key: string, mime: string): Promise<UploadTarget>;
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  remove(key: string): Promise<void>;
}

export { createSupabaseStorage, type SupabaseStorageClient } from './adapters/supabase';

/**
 * 서명된 URL로 파일을 저장소에 직접 올려요. 서버를 거치지 않아요.
 * body는 올릴 내용이에요 (웹과 앱 모두 Blob으로 넘겨요).
 */
export async function uploadFile(target: UploadTarget, body: Blob, mime: string): Promise<void> {
  const response = await fetch(target.url, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body,
  });
  if (!response.ok) throw new Error(`파일을 올리지 못했어요. (${response.status})`);
}
