import { colors } from '@noteapp/ui';
import { Link, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ColorValue, Pressable } from 'react-native';

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

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '오늘',
          tabBarIcon: tabIcon({ ios: 'house', android: 'home', web: 'home' }),
          headerRight: SettingsButton,
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
