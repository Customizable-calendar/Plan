// tailwind.config.js 와 이 페이지의 "코드 내보내기"가 같이 쓰는 색·모서리 설정
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

const colors = {
  border: c('border'),
  input: c('input'),
  ring: c('ring'),
  background: c('background'),
  foreground: c('foreground'),
  primary: {
    DEFAULT: c('primary'),
    foreground: c('primary-foreground'),
    soft: c('primary-soft'),
    'soft-foreground': c('primary-soft-foreground'),
  },
  secondary: {
    DEFAULT: c('secondary'),
    foreground: c('secondary-foreground'),
    soft: c('secondary-soft'),
    'soft-foreground': c('secondary-soft-foreground'),
  },
  destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
  muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
  accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
  popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
  card: { DEFAULT: c('card'), foreground: c('card-foreground') },
  // 앱 전용: 카드 4종
  event: { DEFAULT: c('event'), soft: c('event-soft') },
  task: { DEFAULT: c('task'), soft: c('task-soft') },
  person: { DEFAULT: c('person'), soft: c('person-soft') },
  idea: { DEFAULT: c('idea'), soft: c('idea-soft') },
  // AI 채팅
  ai: { DEFAULT: c('ai'), foreground: c('ai-foreground'), soft: c('ai-soft') },
  bubble: {
    user: c('bubble-user'),
    'user-foreground': c('bubble-user-foreground'),
    ai: c('bubble-ai'),
    'ai-foreground': c('bubble-ai-foreground'),
    'ai-border': c('bubble-ai-border'),
  },
  // 캘린더: 연결한 계정 색
  cal: {
    1: c('cal-1'),
    '1-soft': c('cal-1-soft'),
    2: c('cal-2'),
    '2-soft': c('cal-2-soft'),
  },
};

const borderRadius = {
  sm: 'calc(var(--radius) - 6px)',
  md: 'calc(var(--radius) - 4px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 4px)',
  '2xl': 'calc(var(--radius) + 10px)',
};

module.exports = { colors, borderRadius };
