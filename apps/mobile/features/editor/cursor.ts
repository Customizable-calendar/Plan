import type { TextInputInstance } from 'react-native';

/**
 * 웹 입력칸(textarea)의 지금 커서 위치. 앱에서는 알 수 없어서 null이에요.
 * 웹은 글자를 칠 때 onSelectionChange가 오지 않아서, 글이 바뀔 때 여기서 직접 읽어요.
 */
export function readCursor(input: TextInputInstance | null): number | null {
  const web = input as unknown as { selectionStart?: number | null } | null;
  return typeof web?.selectionStart === 'number' ? web.selectionStart : null;
}

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
