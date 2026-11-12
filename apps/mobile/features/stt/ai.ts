import { AiError, createProvider } from '@noteapp/ai-client';
import type { Card } from '@noteapp/shared';

import { addAiCardsFromTranscript, type TranscriptItem } from '@/features/cards';
import { getAiKey, setAiKey } from '@/lib/secrets';

// 받아쓴 글을 사용자 Gemini 키로 정리해요: 요약 + 일정·할 일 카드.
// 소리는 안 보내고 받아쓴 글만 Google로 가요. 키는 기기 보안 저장소에만 있어요 (docs/decisions/0002).
// TODO(B): 설정(D)에 AI 키 화면이 생기면 여기 키 입력은 그쪽으로 보내요.

export async function hasGeminiKey(): Promise<boolean> {
  return !!(await getAiKey('gemini'));
}

export async function saveGeminiKey(key: string): Promise<void> {
  await setAiKey('gemini', key.trim());
}

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
      },
    },
  },
  required: ['summary', 'items'],
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
 * 받아쓴 글을 Gemini로 요약하고 일정·할 일 카드를 다시 찾아요.
 * replaced: 규칙으로 먼저 찾은 카드 id. AI가 찾은 카드로 바꿔요(확인 안 한 것만).
 */
export async function organizeTranscript(text: string, replaced: string[]): Promise<Organized> {
  const key = await getAiKey('gemini');
  const answer = await createProvider('gemini', key ?? '').complete({
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
