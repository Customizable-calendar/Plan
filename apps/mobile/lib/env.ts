// EXPO_PUBLIC_ 로 시작하는 환경 변수만 앱에 들어가요. 비밀키는 절대 여기에 두지 않아요.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
  storageProvider: process.env.EXPO_PUBLIC_STORAGE_PROVIDER ?? 'supabase',
  dataSource: process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'fixtures',
  /** 쉼표로 나눈 기능 id. 여기 적은 기능만 Supabase를 써요. 예: "cards,devlog" */
  supabaseFeatures: process.env.EXPO_PUBLIC_SUPABASE_FEATURES ?? '',
};
