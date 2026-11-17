/** 업로드한 파일의 메타데이터. 파일 자체는 저장소에, DB에는 키만 둬요. (담당: D) */
export interface FileMeta {
  id: string;
  /** 저장소 안의 경로 */
  key: string;
  /** 목록에 보여 줄 작은 그림의 경로. 그림이 아니면 없어요. */
  thumbnailKey?: string;
  mime: string;
  size: number;
  status: 'pending' | 'ready';
  createdAt: string;
}
