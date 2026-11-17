// 팀 AI(B): 서버에 둔 팀 Claude 키로 앱 기능의 AI 요청을 대신 보내요.
// - 로그인한 팀원(my_team_role())만 써요. 팀원이 아니면 403이에요.
// - 사람마다 하루 AI_DAILY_LIMIT번까지(기본 100). 넘으면 429예요. 횟수·토큰은 ai_usage에 남아요.
// - 요청 원문과 답은 저장하지 않아요.
// - 키는 Supabase secret ANTHROPIC_API_KEY예요. stage는 배포 때 GitHub secret에서 넣어요(docs/deploy.md).
// 요청·답 모양은 @noteapp/ai-client의 AiRequest와 같아요. 앱 쪽은 apps/mobile/lib/team-ai.ts예요.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '100');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
const fail = (status: number, error: string) => reply(status, { error });

interface Body {
  system?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  prompt?: string;
  maxTokens?: number;
  json?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'POST로 불러 주세요.');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return fail(503, '서버에 팀 AI 키가 아직 없어요.');

  // 누가 불렀는지: 앱이 보낸 로그인 토큰으로 확인해요.
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return fail(401, '로그인해야 팀 AI를 쓸 수 있어요.');
  const { data: role } = await asUser.rpc('my_team_role');
  if (!role) return fail(403, '팀원만 팀 AI를 쓸 수 있어요.');

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail(400, '요청을 읽지 못했어요.');
  }
  if (!body.prompt || typeof body.prompt !== 'string') return fail(400, 'prompt가 없어요.');

  // 하루 한도
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: allowed, error: quotaError } = await admin.rpc('ai_take_request', {
    p_user: auth.user.id,
    p_limit: DAILY_LIMIT,
  });
  if (quotaError) return fail(500, '사용량을 확인하지 못했어요.');
  if (!allowed) return fail(429, `오늘 팀 AI를 ${DAILY_LIMIT}번 다 썼어요. 내일 다시 써 주세요.`);

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: Math.min(Math.max(body.maxTokens ?? MAX_TOKENS, 1), MAX_TOKENS),
      // 정책상 거절되면 서버가 알맞은 다른 모델로 다시 돌려요.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        ...(body.json ? { format: { type: 'json_schema', schema: body.json } } : {}),
      },
      ...(body.system ? { system: body.system } : {}),
      messages: [...(body.history ?? []), { role: 'user', content: body.prompt }],
    });
    await admin.rpc('ai_add_tokens', {
      p_user: auth.user.id,
      p_input: res.usage.input_tokens,
      p_output: res.usage.output_tokens,
    });
    if (res.stop_reason === 'refusal') {
      return fail(422, 'AI가 이 요청에는 답하지 않았어요. 내용을 바꿔서 다시 해 주세요.');
    }
    const text = res.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
      .trim();
    if (!text) return fail(502, 'AI 답이 비어 있어요. 다시 해 주세요.');
    return reply(200, { text, truncated: res.stop_reason === 'max_tokens' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError)
      return fail(429, '요청이 많아요. 잠시 뒤에 다시 해 주세요.');
    if (e instanceof Anthropic.AuthenticationError)
      return fail(503, '서버의 팀 AI 키가 맞지 않아요.');
    if (e instanceof Anthropic.BadRequestError)
      return fail(400, `AI 요청이 잘못됐어요: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) return fail(502, 'AI 서버에 연결하지 못했어요.');
    if (e instanceof Anthropic.APIError) return fail(502, `AI 오류 (${e.status ?? '?'})`);
    return fail(500, '팀 AI에서 알 수 없는 오류가 났어요.');
  }
});
