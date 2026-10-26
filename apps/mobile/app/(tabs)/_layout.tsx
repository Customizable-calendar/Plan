import { colors } from '@noteapp/ui';
import { Link, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ColorValue, Pressable } from 'react-native';

// 하단 탭이에요. 탭 이름과 순서는 회의에서 정하기 전까지 임시예요. (담당: D)

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
      <Tabs.Screen
        name="cards"
        options={{
          title: '카드',
          tabBarIcon: tabIcon({ ios: 'rectangle.stack', android: 'style', web: 'style' }),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '캘린더',
          tabBarIcon: tabIcon({
            ios: 'calendar',
            android: 'calendar_month',
            web: 'calendar_month',
          }),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
          tabBarIcon: tabIcon({ ios: 'person.2', android: 'group', web: 'group' }),
        }}
      />
    </Tabs>
  );
}
