import type { AiProvider, AiRequest } from '@noteapp/ai-client';

// M1용 가짜 AI. 실제 요청(buildRequest 결과)을 받아서 섹션 안내에 맞게 카드 줄을 나눠 담아요.
// 보내는 요청 모양은 진짜와 같아서, M3에 createProvider로 바꿔도 화면은 그대로예요.

export const fakeProvider: AiProvider = {
  name: 'claude',
  async complete({ system = '', prompt }: AiRequest) {
    await new Promise((r) => setTimeout(r, 600));

    const sections = system
      .split('\n')
      .filter((l) => l.startsWith('## '))
      .map((l) => {
        const [title, hint = ''] = l.slice(3).split(' — ');
        return { title, hint, lines: [] as string[] };
      });
    if (sections.length === 0) return prompt;

    for (const line of prompt.split('\n').filter((l) => l.startsWith('- ['))) {
      const label = line.match(/^- \[([^\]]+)\]/)?.[1] ?? '';
      const target = sections.find((s) => s.hint.includes(label)) ?? sections[0];
      target.lines.push(line.replace(/^- \[[^\]]+\] /, '- '));
    }

    return sections
      .map((s) => `## ${s.title}\n${s.lines.length ? s.lines.join('\n') : '- 없음'}`)
      .join('\n\n');
  },
};
