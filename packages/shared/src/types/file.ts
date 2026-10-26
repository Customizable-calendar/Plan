/** 업로드한 파일의 메타데이터. 파일 자체는 저장소에, DB에는 키만 둬요. (담당: D) */
export interface FileMeta {
  id: string;
  /** 저장소 안의 경로 */
  key: string;
  mime: string;
  size: number;
  status: 'pending' | 'ready';
  createdAt: string;
}
