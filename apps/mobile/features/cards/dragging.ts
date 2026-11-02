import { useSyncExternalStore } from 'react';

// 카드를 옆으로 미는 동안 바깥 ScrollView 스크롤을 꺼요.
// iOS ScrollView는 PanResponder의 "넘겨주지 않기"를 무시하고 같이 스크롤하기 때문이에요.

let dragging = false;
const listeners = new Set<() => void>();

export function setDragging(next: boolean) {
  if (dragging === next) return;
  dragging = next;
  listeners.forEach((l) => l());
}

export function useDragging() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dragging,
  );
}
