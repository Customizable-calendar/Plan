import '../global.css';

import { palette } from '@noteapp/ui';
import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';

import { stackScreens } from '@/features/registry';

// 화면 이동 구조를 정하는 최상위 레이아웃이에요. (담당: D)
// 라우트 파일(app/)은 조립만 하고, 실제 화면은 features/에서 가져와요.
// 화면 제목·모달 여부는 각 기능 index.ts의 `screens`에서 와요.

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// 상단 바·탭 바 색을 디자인 시스템 색으로 맞춰요.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.muted,
    border: palette.border,
    card: palette.card,
    notification: palette.destructive,
    primary: palette.primary,
    text: palette.foreground,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {stackScreens.map((s) => (
          <Stack.Screen
            key={s.route}
            name={s.route}
            options={{ title: s.title, presentation: s.modal ? 'modal' : undefined }}
          />
        ))}
      </Stack>
    </ThemeProvider>
  );
}
