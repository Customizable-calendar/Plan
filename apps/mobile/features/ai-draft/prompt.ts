import type { AiRequest } from '@noteapp/ai-client';
import type { Card, Template } from '@noteapp/shared';

import { cardDetail, typeLabel } from '@/features/cards';

// 원문 대신 확인한 카드만 짧은 줄로 보내요. 정확하고 토큰도 적게 써요.

/** 카드 한 장을 AI에게 보낼 한 줄로. 예: "- [할 일] 견적서 보내기 (10. 27. (화) 오후 3:00까지)" */
export function cardLine(card: Card): string {
  const detail = cardDetail(card);
  return `- [${typeLabel[card.type]}] ${card.title}${detail ? ` (${detail})` : ''}`;
}

export function buildRequest(template: Template, cards: Card[]): AiRequest {
  const sections = template.sections.map((s) => `## ${s.title} — ${s.hint}`).join('\n');
  return {
    system: [
      `당신은 사용자의 "${template.name}" 초안을 쓰는 도우미예요.`,
      template.aiInstructions,
      '아래 섹션 제목을 그대로 써서 마크다운으로 답해요. "—" 뒤 안내는 쓰지 않아요.',
      '해당하는 카드가 없는 섹션은 "- 없음"으로 써요.',
      sections,
    ].join('\n\n'),
    prompt: `확인한 카드 ${cards.length}장:\n${cards.map(cardLine).join('\n')}`,
    maxTokens: 1024,
  };
}
