import { autoForeground, hexToHslTriplet, mix } from './color';

export type Mode = 'light' | 'dark';

/** global.css 변수 이름과 1:1로 맞춘 토큰 목록 */
export const TOKEN_GROUPS = [
  {
    title: '기본 (react-native-reusables 호환)',
    keys: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'ring',
    ],
  },
  {
    title: '앱 전용: 연한 색',
    keys: [
      'primary-soft',
      'primary-soft-foreground',
      'secondary-soft',
      'secondary-soft-foreground',
    ],
  },
  {
    title: '앱 전용: 카드 4종',
    keys: [
      'event',
      'event-soft',
      'task',
      'task-soft',
      'person',
      'person-soft',
      'idea',
      'idea-soft',
    ],
  },
  {
    title: 'AI 채팅',
    keys: [
      'ai',
      'ai-foreground',
      'ai-soft',
      'bubble-user',
      'bubble-user-foreground',
      'bubble-ai',
      'bubble-ai-foreground',
      'bubble-ai-border',
    ],
  },
  {
    title: '캘린더: 연결한 계정 색',
    keys: ['cal-1', 'cal-1-soft', 'cal-2', 'cal-2-soft'],
  },
] as const;

export type TokenKey = (typeof TOKEN_GROUPS)[number]['keys'][number];
export type Tokens = Record<TokenKey, string>;

export const TOKEN_LABEL: Partial<Record<TokenKey, string>> = {
  background: '화면 배경',
  foreground: '기본 글자',
  card: '카드 배경',
  'card-foreground': '카드 글자',
  popover: '팝업 배경',
  'popover-foreground': '팝업 글자',
  primary: '메인 색',
  'primary-foreground': '메인 위 글자',
  secondary: '서브 색',
  'secondary-foreground': '서브 위 글자',
  muted: '회색 면',
  'muted-foreground': '보조 글자',
  accent: '눌림·호버 면',
  'accent-foreground': '눌림·호버 글자',
  destructive: '삭제·오류',
  'destructive-foreground': '삭제 위 글자',
  border: '테두리',
  input: '입력창 테두리',
  ring: '포커스 링',
  'primary-soft': '메인 연한 면',
  'primary-soft-foreground': '메인 연한 면 글자',
  'secondary-soft': '서브 연한 면',
  'secondary-soft-foreground': '서브 연한 면 글자',
  event: '일정 글자',
  'event-soft': '일정 배경',
  task: '할 일 글자',
  'task-soft': '할 일 배경',
  person: '사람 글자',
  'person-soft': '사람 배경',
  idea: '아이디어 글자',
  'idea-soft': '아이디어 배경',
  ai: 'AI 강조색',
  'ai-foreground': 'AI 강조 위 글자',
  'ai-soft': 'AI 연한 면',
  'bubble-user': '내 말풍선',
  'bubble-user-foreground': '내 말풍선 글자',
  'bubble-ai': 'AI 말풍선',
  'bubble-ai-foreground': 'AI 말풍선 글자',
  'bubble-ai-border': 'AI 말풍선 테두리',
  'cal-1': '계정 1 색 (예: 회사)',
  'cal-1-soft': '계정 1 일정 면',
  'cal-2': '계정 2 색 (예: 개인)',
  'cal-2-soft': '계정 2 일정 면',
};

export type CardType = 'event' | 'task' | 'person' | 'idea';
export const CARD_TYPES: { key: CardType; label: string }[] = [
  { key: 'event', label: '일정' },
  { key: 'task', label: '할 일' },
  { key: 'person', label: '사람' },
  { key: 'idea', label: '아이디어' },
];

export type Neutral = 'cool' | 'warm' | 'pure';
export type FontKey = 'pretendard' | 'noto' | 'system';

export type AiDesign = {
  color: 'primary' | 'secondary' | 'custom';
  customColor: string;
  userBubble: 'primary' | 'soft' | 'muted';
  aiBubble: 'plain' | 'soft' | 'outline';
  shape: 'round' | 'tail' | 'square';
  avatar: 'sparkle' | 'letter' | 'none';
  thinking: 'dots' | 'text' | 'skeleton';
  suggestions: 'chip' | 'list';
  cardView: 'compact' | 'full';
  composer: 'pill' | 'box';
  showSources: boolean;
  showCost: boolean;
};

export type TabLayout = 'original' | 'cards5' | 'lnb4' | 'calendar';

export type NavDesign = {
  /** 하단 탭: 기존 4칸(홈·세션·피드·검색) / 카드 포함 5칸 / 세션을 LNB로 옮긴 4칸(홈·카드·피드·검색) / 캘린더 포함 5칸 */
  tabs: TabLayout;
  /** LNB 여는 방법 */
  open: 'avatar' | 'edge' | 'both';
  /** 선택된 메뉴 표시 */
  selected: 'soft' | 'bar';
  density: 'regular' | 'compact';
  showQuick: boolean;
  showCards: boolean;
  showUsage: boolean;
};

export type CalendarDesign = {
  /** 연결한 캘린더 계정 2개의 색 (실제 앱에서는 계정마다 고름) */
  accounts: [string, string];
  /** 일정 블록: 왼쪽 막대 + 연한 면 / 진한 면 채움 */
  eventStyle: 'bar' | 'fill';
  /** 아직 저장 안 된 AI 후보 일정 */
  suggestion: 'dashed' | 'soft';
  /** 시간 후보의 잘 맞는 정도 표시 */
  fitLabel: 'word' | 'score' | 'none';
  /** 후보마다 이유 문장 보이기 */
  showReasons: boolean;
  /** 1시간 높이 */
  density: 'regular' | 'compact';
  /** 수행 확인 버튼 */
  statusStyle: 'segment' | 'chip';
};

export type DesignState = {
  version: 1;
  mode: Mode;
  primary: string;
  secondary: string;
  destructive: string;
  neutral: Neutral;
  cardColors: Record<CardType, string>;
  radius: number;
  font: FontKey;
  ai: AiDesign;
  nav: NavDesign;
  calendar: CalendarDesign;
  overrides: Record<Mode, Partial<Tokens>>;
};

export const FONTS: Record<FontKey, { label: string; family: string; note: string }> = {
  pretendard: {
    label: 'Pretendard',
    family: 'Pretendard',
    note: 'SIL OFL 1.1 · 한국어 UI용으로 많이 씀',
  },
  noto: { label: 'Noto Sans KR', family: 'Noto Sans KR', note: 'SIL OFL 1.1 · 기존 목업 글꼴' },
  system: { label: '시스템 기본', family: 'System', note: 'iOS는 SF / 안드로이드는 Roboto' },
};

/** 기존 목업(앱 목업.html)에서 뽑은 기본값 */
export const DEFAULT_STATE: DesignState = {
  version: 1,
  mode: 'light',
  primary: '#0b6b8a',
  secondary: '#b5470b',
  destructive: '#d1343a',
  neutral: 'cool',
  cardColors: { event: '#a8430a', task: '#0b5d78', person: '#5b35a8', idea: '#2c6e31' },
  radius: 14,
  font: 'pretendard',
  ai: {
    color: 'primary',
    customColor: '#6d4aff',
    userBubble: 'primary',
    aiBubble: 'soft',
    shape: 'tail',
    avatar: 'sparkle',
    thinking: 'dots',
    suggestions: 'chip',
    cardView: 'full',
    composer: 'pill',
    showSources: true,
    showCost: true,
  },
  nav: {
    tabs: 'lnb4',
    open: 'avatar',
    selected: 'soft',
    density: 'regular',
    showQuick: true,
    showCards: true,
    showUsage: true,
  },
  calendar: {
    accounts: ['#245ab8', '#a3366b'],
    eventStyle: 'bar',
    suggestion: 'dashed',
    fitLabel: 'word',
    showReasons: true,
    density: 'regular',
    statusStyle: 'segment',
  },
  overrides: { light: {}, dark: {} },
};

export const PRESETS: { name: string; note: string; patch: Partial<DesignState> }[] = [
  { name: '목업 기본', note: '틸 + 주황', patch: {} },
  {
    name: '잉크 블루',
    note: '차분한 업무용',
    patch: { primary: '#2f5bd3', secondary: '#e0882f', neutral: 'cool' },
  },
  {
    name: '포레스트',
    note: '초록 + 따뜻한 회색',
    patch: { primary: '#2f6b4f', secondary: '#c2603a', neutral: 'warm' },
  },
  {
    name: '모노',
    note: '검정 메인',
    patch: { primary: '#1d2125', secondary: '#0b6b8a', neutral: 'pure' },
  },
  {
    name: '라벤더',
    note: '보라 + 코랄',
    patch: { primary: '#6247c9', secondary: '#e2586b', neutral: 'cool' },
  },
];

const NEUTRALS: Record<
  Neutral,
  Record<
    Mode,
    { bg: string; fg: string; muted: string; mutedFg: string; border: string; input: string }
  >
> = {
  cool: {
    light: {
      bg: '#ffffff',
      fg: '#15191d',
      muted: '#f3f5f6',
      mutedFg: '#5b6670',
      border: '#e3e7ea',
      input: '#d5dbe0',
    },
    dark: {
      bg: '#0f1417',
      fg: '#e8edf0',
      muted: '#1b2328',
      mutedFg: '#9aa7b0',
      border: '#2a343a',
      input: '#36424a',
    },
  },
  warm: {
    light: {
      bg: '#fffdf9',
      fg: '#1f1b16',
      muted: '#f5f2ec',
      mutedFg: '#6b6358',
      border: '#e8e2d8',
      input: '#dbd3c6',
    },
    dark: {
      bg: '#16130f',
      fg: '#efe9e1',
      muted: '#221e18',
      mutedFg: '#a99f92',
      border: '#332d25',
      input: '#40392f',
    },
  },
  pure: {
    light: {
      bg: '#ffffff',
      fg: '#111111',
      muted: '#f4f4f4',
      mutedFg: '#666666',
      border: '#e5e5e5',
      input: '#d4d4d4',
    },
    dark: {
      bg: '#0a0a0a',
      fg: '#f2f2f2',
      muted: '#1a1a1a',
      mutedFg: '#a3a3a3',
      border: '#2a2a2a',
      input: '#383838',
    },
  },
};

export function aiBaseColor(s: DesignState) {
  if (s.ai.color === 'secondary') return s.secondary;
  if (s.ai.color === 'custom') return s.ai.customColor;
  return s.primary;
}

/** 메인/서브 색 몇 개로 전체 토큰을 만들고, 직접 고친 값(overrides)을 덮어쓴다 */
export function buildTokens(s: DesignState, mode: Mode): Tokens {
  const n = NEUTRALS[s.neutral][mode];
  const dark = mode === 'dark';
  const lift = (c: string) => (dark ? mix(c, '#ffffff', 0.32) : c);
  const soft = (c: string) => (dark ? mix(c, n.bg, 0.78) : mix(c, n.bg, 0.89));
  const softText = (c: string) => (dark ? mix(c, '#ffffff', 0.55) : mix(c, '#000000', 0.12));

  const primary = lift(s.primary);
  const secondary = lift(s.secondary);
  const destructive = lift(s.destructive);
  const ai = lift(aiBaseColor(s));

  const typeText = (c: string) => (dark ? mix(c, '#ffffff', 0.5) : c);
  const typeSoft = (c: string) => (dark ? mix(c, n.bg, 0.75) : mix(c, n.bg, 0.9));

  const userBubble =
    s.ai.userBubble === 'primary' ? primary : s.ai.userBubble === 'soft' ? soft(primary) : n.muted;
  const aiBubble = s.ai.aiBubble === 'soft' ? soft(ai) : n.bg;

  const t: Tokens = {
    background: n.bg,
    foreground: n.fg,
    card: n.bg,
    'card-foreground': n.fg,
    popover: n.bg,
    'popover-foreground': n.fg,
    primary,
    'primary-foreground': autoForeground(primary),
    secondary,
    'secondary-foreground': autoForeground(secondary),
    muted: n.muted,
    'muted-foreground': n.mutedFg,
    accent: soft(primary),
    'accent-foreground': softText(primary),
    destructive,
    'destructive-foreground': autoForeground(destructive),
    border: n.border,
    input: n.input,
    ring: primary,
    'primary-soft': soft(primary),
    'primary-soft-foreground': softText(primary),
    'secondary-soft': soft(secondary),
    'secondary-soft-foreground': softText(secondary),
    event: typeText(s.cardColors.event),
    'event-soft': typeSoft(s.cardColors.event),
    task: typeText(s.cardColors.task),
    'task-soft': typeSoft(s.cardColors.task),
    person: typeText(s.cardColors.person),
    'person-soft': typeSoft(s.cardColors.person),
    idea: typeText(s.cardColors.idea),
    'idea-soft': typeSoft(s.cardColors.idea),
    ai,
    'ai-foreground': autoForeground(ai),
    'ai-soft': soft(ai),
    'bubble-user': userBubble,
    'bubble-user-foreground': s.ai.userBubble === 'primary' ? autoForeground(primary) : n.fg,
    'bubble-ai': aiBubble,
    'bubble-ai-foreground': n.fg,
    'bubble-ai-border': s.ai.aiBubble === 'outline' ? n.border : aiBubble,
    'cal-1': typeText(s.calendar.accounts[0]),
    'cal-1-soft': typeSoft(s.calendar.accounts[0]),
    'cal-2': typeText(s.calendar.accounts[1]),
    'cal-2-soft': typeSoft(s.calendar.accounts[1]),
  };
  return { ...t, ...s.overrides[mode] };
}

/** NativeWind vars()에 넘길 CSS 변수 객체 */
export function tokensToVars(t: Tokens, radius: number) {
  const out: Record<string, string> = {};
  (Object.keys(t) as TokenKey[]).forEach((k) => {
    out[`--${k}`] = hexToHslTriplet(t[k]);
  });
  out['--radius'] = `${radius}px`;
  return out;
}

export const BUBBLE_RADIUS = { round: 18, tail: 18, square: 8 } as const;
