import type { AiMessage } from '@noteapp/ai-client';

import { canUseTeamAi, teamAi } from '@/lib/team-ai';

import { DEVLOG_SYSTEM } from './prompt';

// 앱 안 AI 대화. 서버에 둔 팀 Claude 키로 불러요(lib/team-ai, docs/decisions/0005).
// 로그인한 팀원만, 사람마다 하루 한도 안에서 써요. 각자 키를 넣지 않아요.

/** 지금 계정으로 앱 안 AI를 쓸 수 있는지(로그인한 팀원인지) */
export const canUseAi = canUseTeamAi;

/** 대화를 이어서 AI 답(일지 전체 마크다운)을 받아요. */
export async function askDevlogAi(history: AiMessage[], prompt: string): Promise<string> {
  return teamAi.complete({ system: DEVLOG_SYSTEM, history, prompt });
}
