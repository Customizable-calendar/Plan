import { useSyncExternalStore } from 'react';

import { dataSource } from '@/lib/data-source';
import type { Role } from '@/features/devlog';

// 퀴즈 결과. 빌보드가 이걸로 순위를 매겨요.
// M1: 앱이 켜져 있는 동안만(폰마다 따로). M2: devquiz_results_ 테이블로 팀원끼리 공유해요.

export interface QuizAnswer {
  question: string;
  answer: string;
  /** 0~20 */
  score: number;
  feedback: string;
}

export interface QuizResult {
  id: string;
  author: Role;
  /** 그 주 월요일 "YYYY-MM-DD" (devlog week.ts) */
  week: string;
  /** 0~100 */
  score: number;
  comment: string;
  answers: QuizAnswer[];
  createdAt: string;
}

let results: QuizResult[] = [];
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useQuizResults(): QuizResult[] {
  return useSyncExternalStore(subscribe, () => results);
}

export function resultOf(author: Role, week: string): QuizResult | undefined {
  return results.find((r) => r.author === author && r.week === week);
}

/** 한 사람이 한 주에 한 번만. 첫 시도만 기록해요. */
export async function saveQuizResult(input: Omit<QuizResult, 'id' | 'createdAt'>): Promise<void> {
  if (dataSource !== 'fixtures') throw new Error('devquiz: Supabase 연결은 M2에서 만들어요.');
  if (resultOf(input.author, input.week)) throw new Error('이번 주 퀴즈는 이미 풀었어요.');
  results = [
    { ...input, id: `${input.week}-${input.author}`, createdAt: new Date().toISOString() },
    ...results,
  ];
  listeners.forEach((l) => l());
}
