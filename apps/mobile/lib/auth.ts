import { getSupabase } from './supabase';

// 로그인 관련 호출은 이 파일에만 모아요. (담당: D)
// 나중에 인증 방식을 바꾸게 되면 이 파일만 고치면 돼요.

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

// TODO(D, M2): 로그인 방식(이메일 링크, 구글 등)을 정하고 signIn을 추가해요.
