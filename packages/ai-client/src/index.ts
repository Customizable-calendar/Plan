import type AnthropicClient from '@anthropic-ai/sdk';

type Sdk = typeof AnthropicClient;
let sdk: Sdk | null = null;

/**
 * SDK는 처음 AI를 부를 때 불러와요. 앱을 켤 때 SDK 문제로 화면 전체가 멈추지 않게 해요.
 * Metro가 ESM 빌드(index.mjs)를 고르면 Hermes에서 SDK 안의 순환 import 때문에
 * "Cannot access ... before initialization"이 나서, CJS 빌드(index.js)를 require로 받아요.
 */
function loadSdk(): Sdk {
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('@anthropic-ai/sdk') as { default: Sdk }).default;
  } catch (e) {
    throw new AiError(`AI 모듈을 불러오지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
  }
  return sdk;
}

export type AiProviderName = 'claude' | 'openai' | 'gemini';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  /** 역할·규칙 지시문 (템플릿의 aiInstructions 등) */
  system?: string;
  /** 앞서 주고받은 대화. 이어서 고쳐 달라고 할 때 써요. */
  history?: AiMessage[];
  prompt: string;
  maxTokens?: number;
}

export interface AiProvider {
  name: AiProviderName;
  complete(request: AiRequest): Promise<string>;
}

/** 화면에 그대로 보여줄 수 있는 한국어 오류예요. */
export class AiError extends Error {}

export const CLAUDE_MODEL = 'claude-opus-5-5';

/**
 * 사용자 키로 AI 회사 어댑터를 만들어요. 키는 기기에서 AI 회사로만 가요 (docs/decisions/0002).
 * TODO(B): openai, gemini 어댑터
 */
export function createProvider(name: AiProviderName, apiKey: string): AiProvider {
  if (!apiKey) throw new AiError('AI 키가 없어요. 키를 먼저 저장해 주세요.');
  if (name === 'claude') return claudeProvider(apiKey);
  return {
    name,
    async complete() {
      throw new AiError(`${name} 어댑터는 아직 구현 전이에요.`);
    },
  };
}

function claudeProvider(apiKey: string): AiProvider {
  // 사용자 자기 키를 자기 기기에서 쓰는 구조라 브라우저(Expo 웹) 호출도 허용해요.
  const Anthropic = loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return {
    name: 'claude',
    async complete({ system, history = [], prompt, maxTokens = 16000 }) {
      try {
        const res = await client.beta.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          // 정책상 거절되면 서버가 알맞은 다른 모델로 다시 돌려요.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium' },
          ...(system ? { system } : {}),
          messages: [...history, { role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal') {
          throw new AiError('AI가 이 요청에는 답하지 않았어요. 내용을 바꿔서 다시 해 주세요.');
        }
        const text = res.content
          .flatMap((b) => (b.type === 'text' ? [b.text] : []))
          .join('')
          .trim();
        if (!text) throw new AiError('AI 답이 비어 있어요. 다시 해 주세요.');
        if (res.stop_reason === 'max_tokens') {
          return `${text}\n\n(답이 길어서 중간에 끊겼어요)`;
        }
        return text;
      } catch (e) {
        throw toAiError(e);
      }
    },
  };
}

function toAiError(e: unknown): Error {
  if (e instanceof AiError) return e;
  const Anthropic = loadSdk();
  if (e instanceof Anthropic.AuthenticationError) return new AiError('AI 키가 맞지 않아요.');
  if (e instanceof Anthropic.PermissionDeniedError)
    return new AiError('이 키로는 이 모델을 쓸 수 없어요.');
  if (e instanceof Anthropic.RateLimitError)
    return new AiError('요청이 많아요. 잠시 뒤에 다시 해 주세요.');
  if (e instanceof Anthropic.APIConnectionError)
    return new AiError('AI 서버에 연결하지 못했어요. 인터넷을 확인해 주세요.');
  if (e instanceof Anthropic.APIError)
    return new AiError(`AI 오류 (${e.status ?? '?'}): ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}
