import * as Updates from 'expo-updates';

import { getSupabase } from '@/lib/supabase';

/** 개발 빌드이거나 팀이 같이 쓰는 stage 빌드. 운영(production) 빌드에서는 false예요. */
export const isTestBuild = __DEV__ || Updates.channel === 'stage';

// 카드·일지·퀴즈 테이블은 로그인한 사람만 읽고 써요(RLS). 로그인은 lib/auth.ts(D)예요.
// TODO(B): 개발·stage 빌드에서만 쓰는 익명 로그인이에요. lib/auth.ts에 로그인이 생기면 지워요.
// 동시에 여러 번 불려도 익명 사용자가 하나만 생기게 한 번만 시도해요.
let devSignIn: Promise<boolean> | null = null;

function signInForDev(supabase: ReturnType<typeof getSupabase>) {
  devSignIn ??= supabase.auth.signInAnonymously().then(({ error }) => {
    if (!error) return true;
    console.warn(
      '[auth] 개발용 익명 로그인 실패. Anonymous sign-ins가 켜져 있는지 봐 주세요.',
      error.message,
    );
    devSignIn = null;
    return false;
  });
  return devSignIn;
}

/** 로그인된 Supabase 클라이언트. 로그인 전이면 개발·stage 빌드에서만 익명으로 들어가요. */
export async function signedIn() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return supabase;
  if (isTestBuild && (await signInForDev(supabase))) return supabase;
  throw new Error('로그인이 필요해요. 로그인한 뒤 다시 해 주세요.');
}

/** "인터넷 연결을 확인하고 다시 해 주세요." 안내를 붙여 던져요. */
export function failed(what: string, error: { message: string }): never {
  throw new Error(`${what} 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. (${error.message})`);
}
