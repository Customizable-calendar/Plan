// PR을 올리기 전에 실행해요: pnpm pr:check
// 1) stage 최신과 얼마나 벌어졌는지 2) 열린 PR 중 내 변경 파일과 겹치는 것을 보여줘요.
// 필요한 것: git, gh (gh auth login 완료)
import { execFileSync } from 'node:child_process';

const BASE = 'stage';
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

run('git', ['fetch', '--quiet', 'origin', BASE]);
const branch = run('git', ['branch', '--show-current']);
const behind = Number(run('git', ['rev-list', '--count', `HEAD..origin/${BASE}`]));
const mine = new Set(lines(run('git', ['diff', '--name-only', `origin/${BASE}...HEAD`])));

console.log(`브랜치: ${branch}`);
console.log(`내가 바꾼 파일: ${mine.size}개`);
if (behind > 0) {
  console.log(`\n⚠ origin/${BASE}보다 커밋 ${behind}개 뒤처져 있어요. 먼저 rebase 하세요:`);
  console.log(
    `  git rebase origin/${BASE}  →  충돌 해결  →  pnpm lint && pnpm typecheck && pnpm test`,
  );
} else {
  console.log(`\norigin/${BASE} 최신 위에 있어요.`);
}

const prs = JSON.parse(
  run('gh', [
    'pr',
    'list',
    '--base',
    BASE,
    '--state',
    'open',
    '--json',
    'number,title,author,headRefName,files',
  ]),
).filter((pr) => pr.headRefName !== branch);

const overlaps = prs
  .map((pr) => ({ ...pr, shared: pr.files.map((f) => f.path).filter((p) => mine.has(p)) }))
  .filter((pr) => pr.shared.length > 0);

console.log(`\n열린 PR ${prs.length}개 중 같은 파일을 고치는 PR: ${overlaps.length}개`);
for (const pr of overlaps) {
  console.log(`\n#${pr.number} ${pr.title} (@${pr.author.login})`);
  for (const p of pr.shared) console.log(`  - ${p}`);
}

const migrations = [...mine].filter(
  (p) => p.startsWith('supabase/migrations/') && p.endsWith('.sql'),
);
if (migrations.length > 0) {
  console.log(
    '\n마이그레이션을 바꿨어요. 다른 PR보다 타임스탬프가 앞서면 머지 순서가 꼬일 수 있어요:',
  );
  for (const p of migrations) console.log(`  - ${p}`);
}

if (overlaps.length > 0) {
  console.log(
    '\n겹치는 PR이 있으면 PR 본문 "겹치는 PR"에 번호를 적고, 먼저 머지될 쪽을 작성자와 정해요.',
  );
}
