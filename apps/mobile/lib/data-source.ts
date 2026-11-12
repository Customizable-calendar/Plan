import { env } from './env';

// 기능의 data.ts가 어디서 데이터를 가져올지 정해요.
// M1은 'fixtures'(packages/shared 예시 JSON), M2부터 'supabase'.
// 화면 코드는 data.ts 함수만 부르기 때문에, 바꿀 때 화면은 고치지 않아요.
export type DataSource = 'fixtures' | 'supabase';

export const dataSource: DataSource = env.dataSource === 'supabase' ? 'supabase' : 'fixtures';

const supabaseFeatures = new Set(
  env.supabaseFeatures
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean),
);

/**
 * 기능 하나의 데이터 출처. 앱 전체가 supabase면 supabase, 아니면 EXPO_PUBLIC_SUPABASE_FEATURES에
 * 적힌 기능만 supabase예요. 연결을 끝낸 기능부터 하나씩 켤 수 있어요. id는 features/registry의 id예요.
 */
export function sourceFor(featureId: string): DataSource {
  return dataSource === 'supabase' || supabaseFeatures.has(featureId) ? 'supabase' : 'fixtures';
}

/** 예시 데이터도 실제 요청처럼 비동기로 돌려줘요. 나중에 Supabase로 바꿔도 화면 코드가 같아요. */
export async function fromFixture<T>(value: T): Promise<T> {
  return JSON.parse(JSON.stringify(value)) as T;
}
