import type { Card, Note } from '@noteapp/shared';

export interface ExtractOptions {
  /** "내일", "다음 주" 같은 표현을 계산할 기준 시각 */
  now: Date;
  /** IANA 시간대, 예: Asia/Seoul */
  timezone: string;
  /** 규칙으로 못 잡은 부분만 AI에 보낼 때 쓰는 함수 (M3) */
  ai?: (text: string) => Promise<Card[]>;
}

/**
 * 메모에서 카드 후보를 찾아요. 아직 뼈대라 빈 배열을 돌려줘요.
 * TODO(B, M2): src/rules/에 날짜·시간·사람 규칙을 만들고, 애매한 부분만 options.ai로 보내기
 */
export async function extractCards(note: Note, options: ExtractOptions): Promise<Card[]> {
  if (note.text.trim() === '') return [];
  void options;
  return [];
}
