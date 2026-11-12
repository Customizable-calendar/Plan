import type { Tables } from '@noteapp/shared';
import { useEffect, useSyncExternalStore } from 'react';

import { failed, signedIn } from '@/features/cards';
import { fromFixture, sourceFor } from '@/lib/data-source';

import type { Role } from './members';
import samples from './samples.json';

// 개발일지 목록. 일지 화면과 오늘 화면 섹션이 같이 봐요.
// fixtures: 예시 일지 + 앱이 켜져 있는 동안 쓴 일지.
// supabase: devlog_devlogs 테이블. 팀원 누구나 읽고, 쓴 사람만 고쳐요(RLS).
const source = () => sourceFor('devlog');
const TABLE = 'devlog_devlogs';

type DevlogRow = Tables<'devlog_devlogs'>;

const fromRow = (row: DevlogRow): Devlog => ({
  id: `${row.week}-${row.author}`,
  author: row.author as Role,
  week: row.week,
  body: row.body,
  createdAt: new Date(row.created_at).toISOString(),
});

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
  if (source() === 'fixtures') return fromFixture(samples as Devlog[]);
  const supabase = await signedIn();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('week', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) failed('개발일지를 불러오지', error);
  return (data as DevlogRow[]).map(fromRow);
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
  let log: Devlog = {
    ...input,
    id: `${input.week}-${input.author}`,
    createdAt: new Date().toISOString(),
  };
  if (source() === 'supabase') {
    const supabase = await signedIn();
    // user_id는 DB가 auth.uid()로 채워요. 남이 쓴 같은 주·사람 일지는 RLS가 덮어쓰기를 막아요.
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        { author: input.author, week: input.week, body: input.body },
        { onConflict: 'week,author' },
      )
      .select()
      .single();
    if (error) failed('개발일지를 저장하지', error);
    log = fromRow(data as DevlogRow);
  }
  logs = [log, ...(logs ?? []).filter((l) => !(l.week === log.week && l.author === log.author))];
  emit();
}
