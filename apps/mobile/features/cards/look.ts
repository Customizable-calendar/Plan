import type { CardType } from '@noteapp/shared';
import { colors } from '@noteapp/ui';

// 디자인 시스템(Customizable-calendar/note-app-design-system) 토큰 중 아직 @noteapp/ui에 없는 것.
// 이름은 디자인 시스템 lib/theme.ts와 같아요. 서현(D)이 theme.ts에 같은 이름으로 넣으면
// 그 값을 먼저 쓰고, 다 옮겨지면 이 파일을 지우고 colors를 바로 써요.
// 메인 색은 지금 테마의 accent를 그대로 따라가요.

const ui = colors as Partial<Record<string, string>>;
const pick = (name: string, fallback: string) => ui[name] ?? fallback;

export const look = {
  primary: pick('primary', colors.accent),
  primarySoft: pick('primarySoft', `${colors.accent}14`),
  /** 짐작한 부분 안내 (디자인 시스템 서브 색) */
  secondary: pick('secondary', '#b5470b'),
  secondarySoft: pick('secondarySoft', '#f7ebe4'),
  destructive: pick('destructive', '#d1343a'),
  muted: pick('muted', '#f3f5f6'),
  /** lg 모서리 */
  radius: 14,
};

/** 카드 4종 색. 색만으로 구분하지 않게 항상 글자 라벨과 같이 써요. */
export const typeColor: Record<CardType, { fg: string; bg: string }> = {
  event: { fg: pick('event', '#a8430a'), bg: pick('eventSoft', '#f6ece7') },
  task: { fg: pick('task', '#0b5d78'), bg: pick('taskSoft', '#e7eff2') },
  person: { fg: pick('person', '#5b35a8'), bg: pick('personSoft', '#efebf6') },
  idea: { fg: pick('idea', '#2c6e31'), bg: pick('ideaSoft', '#eaf1ea') },
};
