export type AiProviderName = 'claude' | 'openai' | 'gemini';

export interface AiRequest {
  /** 역할·규칙 지시문 (템플릿의 aiInstructions 등) */
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiProvider {
  name: AiProviderName;
  complete(request: AiRequest): Promise<string>;
}

/**
 * 사용자 키로 AI 회사 어댑터를 만들어요. 아직 뼈대라 호출하면 오류가 나요.
 * TODO(B, M3): Claude 어댑터부터 구현
 */
export function createProvider(name: AiProviderName, apiKey: string): AiProvider {
  if (!apiKey) throw new Error('AI 키가 없어요. 설정에서 키를 먼저 저장해 주세요.');
  return {
    name,
    async complete() {
      throw new Error(`${name} 어댑터는 아직 구현 전이에요.`);
    },
  };
}
