import type { TextInputInstance } from 'react-native';

/**
 * 입력칸 커서(고른 범위)를 옮겨요.
 * 앱 입력칸에는 setSelection이 있고, 웹 입력칸은 HTML textarea라 setSelectionRange를 써요.
 */
export function moveCursor(input: TextInputInstance | null, start: number, end = start) {
  if (!input) return;
  const web = input as unknown as { setSelectionRange?: (start: number, end: number) => void };
  if (typeof web.setSelectionRange === 'function') web.setSelectionRange(start, end);
  else if (typeof input.setSelection === 'function') input.setSelection(start, end);
}
