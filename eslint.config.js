// ESLint 설정 (flat config). 레포 전체를 루트에서 한 번에 검사해요.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/expo-env.d.ts',
      // Edge Functions는 Deno로 돌아가서 따로 검사해요.
      'supabase/functions/**',
      // supabase gen types로 만든 파일이라 손대지 않아요.
      'packages/shared/src/db/database.types.ts',
    ],
  },
  {
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
  },
  {
    // 앱 코드의 경계 규칙: 기능끼리는 index.ts로만 만나고, 외부 서비스는 lib/를 거쳐요.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: '다른 기능은 @/features/<기능> (index.ts)로만 가져와요.',
            },
            {
              group: ['@supabase/supabase-js'],
              message: 'Supabase는 @/lib/supabase의 getSupabase()로만 써요.',
            },
            {
              group: ['expo-secure-store'],
              message: '키 보관은 @/lib/secrets로만 해요.',
            },
          ],
        },
      ],
    },
  },
]);
