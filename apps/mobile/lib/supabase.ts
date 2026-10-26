import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';

// 앱 전체에서 Supabase 클라이언트는 이것 하나만 써요. (담당: D)
// 처음 부를 때 만들어서, .env가 비어 있어도 앱 화면은 뜨게 했어요.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseKey) {
      throw new Error(
        'apps/mobile/.env에 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_KEY를 채워주세요.',
      );
    }
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // TODO(D, M2): 앱이 다시 활성화될 때 토큰 자동 갱신을 켜고 끄기 (AppState)
  }
  return client;
}
