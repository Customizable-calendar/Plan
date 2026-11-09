// 디자인 시스템(note-app-design-system, 기준 커밋 3d34e72)에서 그대로 옮긴 코드예요. (담당: D)
// 모양을 바꾸려면 디자인 시스템 레포에서 바꾸고 다시 옮겨요. 기능 폴더에서 이 파일들을 고치지 않아요.

// 예전 이름 (각자 화면을 옮기는 동안 남겨 둬요, #33)
export { ComingSoon } from './ComingSoon';
export { screen } from './styles';
export { colors, darkPalette, fontSize, palette, radius, space } from './theme';

// 공통
export { cn } from './lib/utils';
export { FontContext, useFontStyle } from './lib/font';
export {
  BUBBLE_RADIUS,
  CARD_TYPES,
  DEFAULT_STATE,
  type AiDesign,
  type CalendarDesign,
  type CardType,
  type NavDesign,
  type TabLayout,
} from './lib/design/tokens';

// components/ui (react-native-reusables)
export * from './components/ui/avatar';
export * from './components/ui/badge';
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/checkbox';
export * from './components/ui/icon';
export * from './components/ui/input';
export * from './components/ui/native-only-animated-view';
export * from './components/ui/progress';
export * from './components/ui/radio-group';
export * from './components/ui/separator';
export * from './components/ui/switch';
export * from './components/ui/tabs';
export * from './components/ui/text';
export * from './components/ui/textarea';

// components/app (앱 공용)
export * from './components/app/calendar';
export * from './components/app/cards';
export * from './components/app/lnb';
export * from './components/app/navigation';
export * from './components/app/overlays';

// components/chat (AI 채팅)
export * from './components/chat/chat';
