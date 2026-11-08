import { palette } from '@noteapp/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { useLnb } from './LnbContext';

// 왼쪽 위 메뉴 버튼(≡). 누르면 왼쪽 메뉴(LNB)가 열려요. 회원 정보는 메뉴 맨 위에 있어요.
export function MenuButton({ className = '' }: { className?: string }) {
  const { show } = useLnb();
  return (
    <Pressable
      onPress={show}
      accessibilityRole="button"
      accessibilityLabel="메뉴 열기"
      hitSlop={10}
      className={`h-10 w-10 items-center justify-center rounded-md active:bg-muted ${className}`}
    >
      <SymbolView
        name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
        size={24}
        tintColor={palette.foreground}
      />
    </Pressable>
  );
}
