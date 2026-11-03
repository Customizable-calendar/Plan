import { colors } from '@noteapp/ui';
import { Link, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ColorValue, Pressable, Text } from 'react-native';

import { tabFeatures } from '@/features/registry';

// 하단 탭이에요. '오늘' 말고는 각 기능 index.ts의 `tab`에서 와요. (담당: D)
// 탭을 추가·변경할 때는 이 파일이 아니라 기능의 `feature.tab`을 고쳐요.

function tabIcon(name: SymbolViewProps['name']) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  };
}

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable accessibilityLabel="설정 열기" hitSlop={12} style={{ marginRight: 16 }}>
        <SymbolView
          name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
          tintColor={colors.ink}
          size={22}
        />
      </Pressable>
    </Link>
  );
}

// 개발 중에만 보이는 버튼이에요. 탭에 없는 화면까지 모아 둔 개발 메뉴(features/dev)를 열어요.
function DevMenuButton() {
  return (
    <Link href="/dev" asChild>
      <Pressable accessibilityLabel="개발 메뉴 열기" hitSlop={12} style={{ marginLeft: 16 }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>개발</Text>
      </Pressable>
    </Link>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '오늘',
          tabBarIcon: tabIcon({ ios: 'house', android: 'home', web: 'home' }),
          headerRight: SettingsButton,
          headerLeft: __DEV__ ? DevMenuButton : undefined,
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
