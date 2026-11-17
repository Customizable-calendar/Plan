import { AiError, createProvider } from '@noteapp/ai-client';
import { cleanTagSuggestions, type TagCategory, type TagSuggestion } from '@noteapp/shared';

import { getAiKey } from './secrets';
import { listTagCategories, withoutDismissed } from './tag-categories';

// 해시태그 자동 분류 추천(방법 2): 사용자 Gemini 키로 뜻이 비슷한 해시태그를 묶어요.
// 같이 쓰인 해시태그로 묶는 규칙 추천(방법 1, C)이 못 잡는 것(예: #러닝, #헬스)을 잡아요.
// Google로는 해시태그 이름과 카테고리 이름만 가요. 메모·일정 본문은 안 보내요.
// 키는 기기 보안 저장소에만 있어요(docs/decisions/0002).
// 결과는 추천일 뿐이에요. 화면에서 확인(acceptSuggestion)하거나 거절(dismissSuggestion)해요.

/** 한 번에 보내는 해시태그 수 */
const MAX_TAGS = 200;

const SCHEMA = {
  type: 'object',
  properties: {
    assign: {
      type: 'array',
      description: '있는 카테고리에 넣을 해시태그',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: '받은 해시태그를 # 포함 글자 그대로' },
          categoryId: { type: 'string', description: '받은 카테고리 id 그대로' },
        },
        required: ['tag', 'categoryId'],
      },
    },
    groups: {
      type: 'array',
      description: '어느 카테고리에도 안 맞는 해시태그로 만들 새 카테고리',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '카테고리 이름. 짧은 한국어 명사, 15자 이내' },
          tags: { type: 'array', items: { type: 'string' }, description: '2개 이상' },
        },
        required: ['name', 'tags'],
      },
    },
  },
  required: ['assign', 'groups'],
};

const SYSTEM = [
  '너는 메모·일정 앱의 해시태그를 뜻이 비슷한 것끼리 분류해.',
  '카테고리가 없는 해시태그만 분류해. 해시태그 하나는 한 곳에만 넣어.',
  '- 있는 카테고리와 뜻이 맞으면 assign에 넣어. categoryId는 받은 것만 써.',
  '- 서로 뜻이 비슷한 것끼리 2개 이상 모이면 groups로 새 카테고리를 만들고 이름을 지어.',
  '- 애매하면 아무 데도 넣지 마. 억지로 묶지 마.',
  '해시태그는 받은 글자 그대로 써. 새 해시태그를 지어내지 마.',
].join('\n');

export async function hasTagAiKey(): Promise<boolean> {
  return !!(await getAiKey('gemini'));
}

/**
 * 쓰고 있는 해시태그(메모·일정에서 모은 것)를 받아 AI 분류 추천을 돌려줘요.
 * 이미 묶인 해시태그와 거절한 추천은 빠져요. 분류할 게 없으면 AI를 안 불러요.
 */
export async function suggestTagCategoriesWithAi(
  usedTags: Iterable<string>,
): Promise<TagSuggestion[]> {
  const categories = await listTagCategories();
  const known = [...new Set(usedTags)];
  const grouped = new Set(categories.flatMap((c) => c.tags));
  const free = known.filter((t) => !grouped.has(t)).slice(0, MAX_TAGS);
  if (free.length === 0) return [];

  const key = await getAiKey('gemini');
  const answer = await createProvider('gemini', key ?? '').complete({
    system: SYSTEM,
    prompt: promptFor(categories, free),
    json: SCHEMA,
    maxTokens: 4000,
  });
  let parsed: {
    assign?: { tag: string; categoryId: string }[];
    groups?: { name: string; tags: string[] }[];
  };
  try {
    parsed = JSON.parse(answer) as typeof parsed;
  } catch {
    throw new AiError('AI 답을 읽지 못했어요. 다시 해 주세요.');
  }
  const raw: TagSuggestion[] = [
    ...(parsed.assign ?? []).map((a) => ({
      kind: 'assign' as const,
      tag: a.tag,
      categoryId: a.categoryId,
    })),
    ...(parsed.groups ?? []).map((g) => ({ kind: 'group' as const, tags: g.tags, name: g.name })),
  ];
  return withoutDismissed(cleanTagSuggestions(raw, categories, known));
}

function promptFor(categories: TagCategory[], free: string[]): string {
  const lines = categories.map(
    (c) => `- id=${c.id} 이름=${c.name} 해시태그=${c.tags.join(' ') || '(없음)'}`,
  );
  return [
    '있는 카테고리:',
    lines.length > 0 ? lines.join('\n') : '(없음)',
    '',
    '분류할 해시태그:',
    free.join(' '),
  ].join('\n');
}
