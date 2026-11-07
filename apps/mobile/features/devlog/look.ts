import { colors, palette } from '@noteapp/ui';

// 디자인 시스템(Customizable-calendar/note-app-design-system) 토큰 중 아직 @noteapp/ui에 없는 것.
// 이름은 디자인 시스템 lib/theme.ts와 같아요. 서현(D)이 theme.ts에 같은 이름으로 넣으면
// 그 값을 먼저 쓰고, 다 옮겨지면 이 파일을 지우고 colors를 바로 써요.
// 메인 색은 지금 테마의 accent를 그대로 따라가요.

const ui = palette as Partial<Record<string, string>>;
const pick = (name: string, fallback: string) => ui[name] ?? fallback;

const primary = pick('primary', colors.accent);
const primarySoft = pick('primarySoft', `${colors.accent}14`);

export const look = {
  primary,
  primarySoft,
  destructive: pick('destructive', '#d1343a'),
  muted: pick('muted', '#f3f5f6'),
  input: pick('input', '#d5dbe0'),
  // AI 채팅: 디자인 시스템 기본값(AI 색 = 메인 색, AI 말풍선 = 연한 메인 색)
  ai: pick('ai', primary),
  aiSoft: pick('aiSoft', primarySoft),
  bubbleUser: pick('bubbleUser', primary),
  bubbleAi: pick('bubbleAi', primarySoft),
  /** lg 모서리 */
  radius: 14,
  /** 말풍선 모서리(꼬리 모양: 꼬리 쪽 한 귀퉁이만 4) */
  bubble: 18,
};
