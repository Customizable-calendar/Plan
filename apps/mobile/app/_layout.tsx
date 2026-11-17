import '../global.css';

import { palette } from '@noteapp/ui';
import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';

import { stackScreens } from '@/features/registry';
import { useLatestUpdate } from '@/lib/updates';
import { Lnb } from '@/shell/Lnb';
import { LnbProvider } from '@/shell/LnbContext';

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

// 로그인 없이도 앱을 써요. 로그인 전에는 메모·일정·카드가 이 기기에만, 로그인하면 계정에도 저장돼요(lib/local-first.ts).
// 로그인은 설정의 계정 칸에서 열어요. 개발일지·퀴즈처럼 계정이 꼭 필요한 화면은 그 화면에서 로그인을 안내해요.
export default function RootLayout() {
  useLatestUpdate(); // 머지된 새 버전을 켤 때 바로 적용해요 (lib/updates.ts)

  return (
    <ThemeProvider value={navTheme}>
      <LnbProvider>
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
          <Stack.Screen name="login" options={{ title: '로그인', presentation: 'modal' }} />
        </Stack>
        <Lnb />
      </LnbProvider>
    </ThemeProvider>
  );
}
