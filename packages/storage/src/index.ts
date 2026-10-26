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

export { createSupabaseStorage } from './adapters/supabase';
