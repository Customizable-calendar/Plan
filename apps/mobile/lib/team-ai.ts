import { AiError, type AiProvider, type AiRequest } from '@noteapp/ai-client';

import { getSupabase } from './supabase';

// 팀 AI: 서버(Edge Function `ai`)에 둔 팀 Claude 키로 AI를 불러요. 각자 키를 넣지 않아도 돼요.
// 로그인한 팀원만, 사람마다 하루 한도 안에서 써요(supabase/functions/ai, docs/decisions/0005).
// 쓰는 법은 사용자 키 어댑터와 같아요: teamAi.complete({ system, prompt, json }).

interface Answer {
  text?: string;
  truncated?: boolean;
  error?: string;
}

export const teamAi: AiProvider = {
  name: 'claude',
  async complete(request: AiRequest): Promise<string> {
    const { data, error } = await getSupabase().functions.invoke<Answer>('ai', { body: request });
    if (error) throw new AiError(await messageOf(error));
    if (!data?.text) throw new AiError(data?.error ?? 'AI 답이 비어 있어요. 다시 해 주세요.');
    return data.truncated ? `${data.text}\n\n(답이 길어서 중간에 끊겼어요)` : data.text;
  },
};

/** 함수가 돌려준 한국어 오류를 그대로 보여 줘요. */
async function messageOf(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as Answer;
      if (body.error) return body.error;
    } catch {
      // 본문이 JSON이 아니면 아래 기본 문구
    }
  }
  return '팀 AI를 부르지 못했어요. 인터넷과 로그인을 확인해 주세요.';
}

/** 지금 계정으로 팀 AI를 쓸 수 있는지(로그인한 팀원인지). 화면에서 버튼을 보일지 정할 때 써요. */
export async function canUseTeamAi(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return false;
    const { data } = await supabase.rpc('my_team_role');
    return Boolean(data);
  } catch {
    return false;
  }
}
