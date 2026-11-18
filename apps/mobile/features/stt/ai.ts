import { AiError } from '@noteapp/ai-client';
import type { Card, SttTransform } from '@noteapp/shared';

import { addAiCardsFromTranscript, type TranscriptItem } from '@/features/cards';
import { canUseTeamAi, teamAi } from '@/lib/team-ai';

// 받아쓴 글을 팀 AI(서버에 둔 팀 Claude 키, lib/team-ai, docs/decisions/0005)로 정리해요.
// - organizeTranscript: 요약 + 일정·할 일 카드
// - runTransform: 내 지시문(회의록 정리, 할 일만 뽑기 등)을 적용한 새 글
// 소리는 안 보내고 받아쓴 글만 보내요. 로그인한 팀원만, 사람마다 하루 한도 안에서 써요.

/** 지금 계정으로 팀 AI를 쓸 수 있는지(로그인한 팀원인지) */
export const canUseAi = canUseTeamAi;

const TIMEZONE = 'Asia/Seoul';

const SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: '회의 요약. 핵심만 3~6줄, 줄마다 "- "로 시작',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['event', 'task'] },
          title: { type: 'string', description: '카드 제목. 짧은 명사구 (예: "디자인 리뷰")' },
          startAt: { type: 'string', description: '일정 시작. ISO 8601, +09:00. 모르면 빈 문자열' },
          endAt: { type: 'string', description: '일정 끝. 모르면 빈 문자열' },
          dueAt: { type: 'string', description: '할 일 마감. 모르면 빈 문자열' },
          quote: { type: 'string', description: '근거가 된 원문 문장을 글자 그대로 복사' },
        },
        required: ['type', 'title', 'startAt', 'endAt', 'dueAt', 'quote'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'items'],
  additionalProperties: false,
};

function systemPrompt(now: Date): string {
  const today = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now);
  return [
    '너는 한국어 회의 받아쓰기를 정리해. 받아쓰기라서 틀린 글자나 끊긴 문장이 있을 수 있어.',
    `지금은 ${today} (${TIMEZONE})야. "다음 주 화요일" 같은 말은 이 날짜로 계산해.`,
    'items에는 캘린더나 할 일 목록에 등록할 만한 것만 넣어:',
    '- event: 날짜나 시간이 정해진 약속·회의·일정',
    '- task: 누가 하기로 한 일, 마감이 있으면 dueAt',
    '지난 일, 잡담, 이미 끝난 일은 넣지 마. 같은 일은 한 번만. 없으면 빈 배열.',
    '원문에 없는 내용을 지어내지 마.',
  ].join('\n');
}

export interface Organized {
  summary: string;
  cards: Card[];
}

/**
 * 받아쓴 글을 팀 AI로 요약하고 일정·할 일 카드를 다시 찾아요.
 * replaced: 규칙으로 먼저 찾은 카드 id. AI가 찾은 카드로 바꿔요(확인 안 한 것만).
 */
export async function organizeTranscript(text: string, replaced: string[]): Promise<Organized> {
  const answer = await teamAi.complete({
    system: systemPrompt(new Date()),
    prompt: `받아쓴 회의록:\n\n${text}`,
    json: SCHEMA,
    maxTokens: 8000,
  });
  let parsed: { summary?: string; items?: TranscriptItem[] };
  try {
    parsed = JSON.parse(answer) as typeof parsed;
  } catch {
    throw new AiError('AI 답을 읽지 못했어요. 다시 해 주세요.');
  }
  const items = (parsed.items ?? []).map((i) => ({
    ...i,
    startAt: i.startAt || undefined,
    endAt: i.endAt || undefined,
    dueAt: i.dueAt || undefined,
  }));
  const cards = await addAiCardsFromTranscript(text, items, replaced);
  return { summary: (parsed.summary ?? '').trim(), cards };
}

/**
 * 받아쓴 글에 지시문을 적용해서 새 글을 받아요. 받아쓴 글은 바꾸지 않아요.
 * 지시문이 system, 받아쓴 글이 prompt예요(Whispering과 같은 모양).
 */
export async function runTransform(transform: SttTransform, text: string): Promise<string> {
  const answer = await teamAi.complete({
    system: [
      transform.instructions,
      '',
      '받아쓴 글은 음성 인식 결과라서 틀린 글자나 끊긴 문장이 있을 수 있어. 뜻이 맞게 고쳐 읽어.',
      '원문에 없는 내용은 지어내지 마. 한국어로 답해. 앞뒤 인사말 없이 결과만 써.',
    ].join('\n'),
    prompt: `받아쓴 글:\n\n${text}`,
    maxTokens: 4000,
  });
  return answer.trim();
}
