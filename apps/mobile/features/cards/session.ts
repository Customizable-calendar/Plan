import * as Updates from 'expo-updates';

import { getSupabase } from '@/lib/supabase';

/**
 * 개발 빌드이거나 팀이 같이 쓰는 stage 빌드(APK는 채널, 웹은 EXPO_PUBLIC_TEST_BUILD).
 * 운영(production) 빌드에서는 false예요.
 */
export const isTestBuild =
  __DEV__ || Updates.channel === 'stage' || process.env.EXPO_PUBLIC_TEST_BUILD === 'true';

// 카드·일지·퀴즈 테이블은 로그인한 사람만 읽고 써요(RLS). 로그인 화면은 lib/auth.ts와 app/login.tsx예요.

/** 로그인된 Supabase 클라이언트. 로그인 전이면 안내를 던져요. (보통은 루트 레이아웃이 로그인 화면으로 먼저 보내요) */
export async function signedIn() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return supabase;
  throw new Error('로그인이 필요해요. 로그인한 뒤 다시 해 주세요.');
}

/** 안내를 붙여 던져요. RLS에 막힌 경우(42501)는 권한 안내로 바꿔요. */
export function failed(what: string, error: { message: string; code?: string }): never {
  if (error.code === '42501')
    throw new Error(`${what} 못했어요. 팀원 계정으로, 내 이름으로만 쓸 수 있어요.`);
  throw new Error(`${what} 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. (${error.message})`);
}
