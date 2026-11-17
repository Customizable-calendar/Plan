import type { TemplateIcon } from '@noteapp/shared';
import type { SymbolViewProps } from 'expo-symbols';

// 양식 JSON의 아이콘 이름을 실제 아이콘으로 바꿔요. (iOS: SF Symbols, 안드로이드·웹: Material)
const ICONS: Record<TemplateIcon, SymbolViewProps['name']> = {
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  pencil: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
  bubble: {
    ios: 'bubble.left.and.bubble.right',
    android: 'forum',
    web: 'forum',
  },
  flask: { ios: 'flask', android: 'science', web: 'science' },
  book: { ios: 'book', android: 'menu_book', web: 'menu_book' },
};

const FALLBACK: SymbolViewProps['name'] = {
  ios: 'doc.text',
  android: 'description',
  web: 'description',
};

export function templateIcon(icon: TemplateIcon | undefined): SymbolViewProps['name'] {
  return icon ? ICONS[icon] : FALLBACK;
}
