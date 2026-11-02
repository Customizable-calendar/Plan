import { useEffect, useSyncExternalStore } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

import type { Role } from './members';
import samples from './samples.json';

// 개발일지 목록. 일지 화면과 오늘 화면 섹션이 같이 봐요.
// M1: 예시 일지 + 앱이 켜져 있는 동안 쓴 일지. M2: devlogs_ 테이블(팀원끼리 공유)로 바꿔요.

export interface Devlog {
  id: string;
  author: Role;
  /** 그 주 월요일 "YYYY-MM-DD" (week.ts) */
  week: string;
  /** 붙여 넣은 마크다운 원문. 화면에서 섹션으로 나눠 보여줘요. */
  body: string;
  createdAt: string;
}

let logs: Devlog[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function listDevlogs(): Promise<Devlog[]> {
  if (dataSource === 'fixtures') return fromFixture(samples as Devlog[]);
  throw new Error('devlog: Supabase 연결은 M2에서 만들어요.');
}

function load() {
  loading ??= listDevlogs().then((list) => {
    logs = list;
    emit();
  });
  return loading;
}

export function useDevlogs() {
  useEffect(() => {
    void load();
  }, []);
  const snapshot = useSyncExternalStore(subscribe, () => logs);
  return { logs: snapshot ?? [], loading: snapshot === null };
}

/** 같은 사람이 같은 주에 또 쓰면 바꿔 써요. 한 주에 한 사람 한 편이에요. */
export async function saveDevlog(input: Omit<Devlog, 'id' | 'createdAt'>): Promise<void> {
  await load();
  if (dataSource !== 'fixtures') throw new Error('devlog: Supabase 연결은 M2에서 만들어요.');
  const log: Devlog = {
    ...input,
    id: `${input.week}-${input.author}`,
    createdAt: new Date().toISOString(),
  };
  logs = [log, ...(logs ?? []).filter((l) => !(l.week === log.week && l.author === log.author))];
  emit();
}
