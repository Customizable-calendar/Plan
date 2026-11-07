import type { ExecutionResult } from '@noteapp/shared';

export const resultLabels: Record<ExecutionResult, string> = {
  done: '완료',
  partial: '부분',
  not_done: '못 함',
  unknown: '모름',
};
export const resultOrder: ExecutionResult[] = ['done', 'partial', 'not_done', 'unknown'];
