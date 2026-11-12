#!/usr/bin/env node
// pnpm stage: stage 최신 코드 + stage Supabase로 개발 서버를 켜요. 아이폰(Expo Go)으로 stage를 볼 때 써요.
//   1) stage 브랜치로 바꾸고 최신으로 받아요 (고친 파일이 있으면 멈춰요)
//   2) pnpm install
//   3) GitHub stage 환경 Variable(EXPO_PUBLIC_*)을 읽어서 개발 서버에 넘겨요. .env 파일은 안 건드려요.
//   4) Expo 개발 서버를 켜요. QR을 아이폰 카메라로 찍으면 돼요.
// 옵션: --tunnel (폰이 컴퓨터를 못 찾을 때), --here (지금 브랜치 그대로, 받기·설치 건너뛰기)
// 필요: gh 로그인(gh auth login). 비밀값(Secret)은 읽지 않아요. 공개돼도 되는 Variable만이에요.
import { execSync, spawn } from 'node:child_process';

const REPO = 'Customizable-calendar/Plan';
const args = new Set(process.argv.slice(2));
const tunnel = args.has('--tunnel');
const here = args.has('--here');

const say = (msg) => console.log(`\n▶ ${msg}`);
function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}
// 명령은 이 파일에 적힌 고정 문자열만 써요(사용자 입력 없음). Windows의 pnpm.cmd·gh 때문에 셸로 실행해요.
const run = (line, opts = {}) => (execSync(line, { encoding: 'utf8', ...opts }) ?? '').trim();

if (!here) {
  say('stage 최신 코드 받기');
  const dirty = run('git status --porcelain --untracked-files=no');
  if (dirty)
    fail(
      '고친 파일이 있어서 브랜치를 못 바꿔요. 커밋하거나 git stash 한 뒤 다시 해 주세요.\n' +
        '  지금 브랜치 그대로 켜려면: pnpm stage --here',
    );
  run('git fetch origin stage', { stdio: 'inherit' });
  run('git checkout stage', { stdio: 'inherit' });
  run('git pull --ff-only origin stage', { stdio: 'inherit' });

  say('패키지 설치');
  run('pnpm install --frozen-lockfile', { stdio: 'inherit' });
}

say('stage 설정 읽기 (GitHub stage 환경)');
let vars;
try {
  vars = JSON.parse(
    run(`gh variable list -R ${REPO} --env stage --json name,value`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
} catch {
  fail('GitHub에서 stage 설정을 못 읽었어요. gh auth login으로 로그인했는지 봐 주세요.');
}
const env = Object.fromEntries(
  vars.filter((v) => v.name.startsWith('EXPO_PUBLIC_')).map((v) => [v.name, v.value]),
);
if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_KEY)
  fail(
    'stage 환경에 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY가 없어요. (docs/deploy.md)',
  );
for (const [k, v] of Object.entries(env))
  console.log(`  ${k}=${k.endsWith('_KEY') ? '(공개 키)' : v}`);

say(`개발 서버 켜기${tunnel ? ' (tunnel)' : ''}. QR을 아이폰 카메라로 찍어 주세요. 끄려면 Ctrl+C`);
// 프로세스 환경 변수가 .env보다 먼저라 내 .env는 그대로 두고 stage 값으로 켜져요.
const child = spawn(`pnpm --filter mobile start --clear${tunnel ? ' --tunnel' : ''}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...env },
});
child.on('exit', (code) => process.exit(code ?? 0));
