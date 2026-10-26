import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// 화면 이동 구조를 정하는 최상위 레이아웃이에요. (담당: D)
// 라우트 파일(app/)은 조립만 하고, 실제 화면은 features/에서 가져와요.

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        <Stack.Screen name="sessions" options={{ title: '세션' }} />
        <Stack.Screen name="editor/[id]" options={{ title: '편집기' }} />
        <Stack.Screen name="draft" options={{ title: 'AI 초안', presentation: 'modal' }} />
        <Stack.Screen
          name="execution"
          options={{ title: '오늘 한 일 확인', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
