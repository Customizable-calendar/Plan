// EXPO_PUBLIC_ 로 시작하는 환경 변수만 앱에 들어가요. 비밀키는 절대 여기에 두지 않아요.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
  storageProvider: process.env.EXPO_PUBLIC_STORAGE_PROVIDER ?? 'supabase',
};
