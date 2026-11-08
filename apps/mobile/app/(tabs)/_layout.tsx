import { palette } from '@noteapp/ui';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { tabFeatures } from '@/features/registry';
import { MenuButton } from '@/shell/MenuButton';

// 하단 탭: 홈, 카드, 피드, 검색 (디자인 시스템 lnb4). (담당: D)
// '홈' 말고는 각 기능 index.ts의 `tab`에서 와요. 캘린더, 세션, 설정은 왼쪽 메뉴로 들어가요.

function tabIcon(name: SymbolViewProps['name']) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  };
}

function HeaderMenu() {
  return <MenuButton className="ml-2" />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.mutedForeground,
        headerLeft: HeaderMenu,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          headerShown: false,
          tabBarIcon: tabIcon({ ios: 'house', android: 'home', web: 'home' }),
        }}
      />
      {tabFeatures.map((f) => (
        <Tabs.Screen
          key={f.id}
          name={f.id}
          options={{ title: f.tab.title, tabBarIcon: tabIcon(f.tab.icon) }}
        />
      ))}
    </Tabs>
  );
}
