import type { Json, Tables } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { failed, signedIn } from '@/features/cards';
import type { Role } from '@/features/devlog';
import { sourceFor } from '@/lib/data-source';

// 퀴즈 결과. 빌보드가 이걸로 순위를 매겨요.
// fixtures: 앱이 켜져 있는 동안만(폰마다 따로).
// supabase: devquiz_results 테이블. 팀원 누구나 읽고, 한 번 낸 결과는 못 바꿔요(RLS).
const source = () => sourceFor('devquiz');
const TABLE = 'devquiz_results';

type ResultRow = Tables<'devquiz_results'>;

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

const fromRow = (row: ResultRow): QuizResult => ({
  id: `${row.week}-${row.author}`,
  author: row.author as Role,
  week: row.week,
  score: row.score,
  comment: row.comment,
  answers: row.answers as unknown as QuizAnswer[],
  createdAt: new Date(row.created_at).toISOString(),
});

let results: QuizResult[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function listResults(): Promise<QuizResult[]> {
  if (source() === 'fixtures') return [];
  const supabase = await signedIn();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) failed('퀴즈 결과를 불러오지', error);
  return (data as ResultRow[]).map(fromRow);
}

function load() {
  loading ??= listResults()
    .then((list) => {
      results = list;
      emit();
    })
    .catch((error: unknown) => {
      // 다음에 화면을 열 때 다시 시도해요.
      loading = null;
      console.warn('[devquiz]', error instanceof Error ? error.message : error);
    });
  return loading;
}

export function useQuizResults(): QuizResult[] {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(subscribe, () => results);
}

export function resultOf(author: Role, week: string): QuizResult | undefined {
  return results.find((r) => r.author === author && r.week === week);
}

/** 한 사람이 한 주에 한 번만. 첫 시도만 기록해요. */
export async function saveQuizResult(input: Omit<QuizResult, 'id' | 'createdAt'>): Promise<void> {
  await load();
  if (resultOf(input.author, input.week)) throw new Error('이번 주 퀴즈는 이미 풀었어요.');
  let saved: QuizResult = {
    ...input,
    id: `${input.week}-${input.author}`,
    createdAt: new Date().toISOString(),
  };
  if (source() === 'supabase') {
    const supabase = await signedIn();
    // user_id는 DB가 auth.uid()로 채워요. 같은 주·사람은 기본 키라 두 번 못 내요.
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        author: input.author,
        week: input.week,
        score: input.score,
        comment: input.comment,
        answers: input.answers as unknown as Json,
      })
      .select()
      .single();
    if (error?.code === '23505') throw new Error('이번 주 퀴즈는 이미 풀었어요.');
    if (error) failed('퀴즈 결과를 저장하지', error);
    saved = fromRow(data as ResultRow);
  }
  results = [saved, ...results];
  emit();
}
