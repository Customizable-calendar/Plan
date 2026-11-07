import { type AiMessage, createProvider } from '@noteapp/ai-client';

import { getAiKey, setAiKey } from '@/lib/secrets';

import { DEVLOG_SYSTEM } from './prompt';

// 앱 안 AI 대화. 키는 기기 보안 저장소에만 있어요 (lib/secrets, docs/decisions/0002).
// TODO(B): 설정(D)에 AI 키 화면이 생기면 여기 키 입력은 그쪽으로 보내요.

export async function hasAiKey(): Promise<boolean> {
  return !!(await getAiKey('claude'));
}

export async function saveAiKey(key: string): Promise<void> {
  await setAiKey('claude', key.trim());
}

/** 대화를 이어서 AI 답(일지 전체 마크다운)을 받아요. */
export async function askDevlogAi(history: AiMessage[], prompt: string): Promise<string> {
  const key = await getAiKey('claude');
  return createProvider('claude', key ?? '').complete({ system: DEVLOG_SYSTEM, history, prompt });
}
