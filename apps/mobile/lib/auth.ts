import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { dataSource } from './data-source';
import { env } from './env';
import { getSupabase } from './supabase';

// 로그인 관련 호출은 이 파일에만 모아요. 인증 방식을 바꾸게 되면 이 파일만 고쳐요.
// 방식: 이메일로 받은 숫자 코드 (비밀번호 없음, 길이는 대시보드 Email OTP Length). docs/auth.md

/** Supabase를 쓰는 기능이 하나라도 있으면 로그인해야 앱을 써요. 예시 데이터만 쓰면 로그인 없이 돼요. */
export const loginRequired =
  Boolean(env.supabaseUrl && env.supabaseKey) &&
  (dataSource === 'supabase' || String(env.supabaseFeatures).trim() !== '');

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

/** 로그인 상태. 처음 읽는 동안은 undefined, 로그아웃이면 null이에요. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(
    loginRequired ? undefined : null,
  );
  useEffect(() => {
    if (!loginRequired) return;
    const auth = getSupabase().auth;
    let alive = true;
    void auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return session;
}

const normalize = (email: string) => email.trim().toLowerCase();

/** 이메일로 로그인 코드를 보내요. 처음 쓰는 이메일이면 계정이 같이 만들어져요. */
export async function sendLoginCode(email: string) {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: normalize(email),
    options: { shouldCreateUser: true },
  });
  if (!error) return;
  if (error.status === 429)
    throw new Error('코드를 너무 자주 보냈어요. 1분쯤 뒤에 다시 해 주세요.');
  throw new Error(`코드를 보내지 못했어요. 이메일 주소를 확인해 주세요. (${error.message})`);
}

/** 받은 코드로 로그인해요. */
export async function verifyLoginCode(email: string, code: string) {
  const { error } = await getSupabase().auth.verifyOtp({
    email: normalize(email),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw new Error('코드가 맞지 않거나 시간이 지났어요. 다시 받아 주세요.');
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export type TeamRole = 'A' | 'B' | 'C' | 'D';

/** 팀원이면 'A'~'D', 아니면 null. 일지·퀴즈의 "누가"를 정해요. (DB 함수 my_team_role) */
export async function getMyTeamRole(): Promise<TeamRole | null> {
  const { data, error } = await getSupabase().rpc('my_team_role');
  if (error) throw error;
  return (data as TeamRole | null) ?? null;
}

/** 내 팀 역할. 읽는 동안·팀원이 아니면 null. 로그인이 바뀌면 다시 읽어요. */
export function useMyTeamRole(): TeamRole | null {
  const session = useSession();
  const [role, setRole] = useState<TeamRole | null>(null);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getMyTeamRole().then(
      (r) => alive && setRole(r),
      () => alive && setRole(null),
    );
    return () => {
      alive = false;
    };
  }, [userId]);
  return userId ? role : null;
}
