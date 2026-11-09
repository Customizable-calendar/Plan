// 디자인은 서현(D)만 바꿔요. CI의 check에서 PR마다 돌아요(.github/workflows/ci.yml).
// 1. 디자인 파일(DESIGN_PATHS)을 DESIGN_OWNERS가 아닌 사람이 바꾸면 실패해요.
// 2. 기능 폴더에 색을 직접 적거나(#0b6b8a, rgb()) 토큰을 복사한 파일(look.ts 등)이 있으면 알려요.
//    지금은 각자 옮기는 중이라(#33 3단계) 경고만 해요. 다 옮기면 STRICT_COLORS를 true로 바꿔요.
//
// 로컬: node scripts/check-design.mjs  (PR 작성자 검사는 CI에서만 해요)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DESIGN_OWNERS = ['YoonDiding'];
const DESIGN_PATHS = [
  'packages/ui/',
  'apps/mobile/design/',
  'apps/mobile/global.css',
  'apps/mobile/tailwind.config.js',
  'scripts/check-design.mjs',
  '.github/workflows/ci.yml',
];
const STRICT_COLORS = false;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

// 1. 디자인 파일을 바꾼 사람
const author = process.env.PR_AUTHOR;
const base = process.env.PR_BASE;
// 이 검사를 처음 넣는 PR은 stage에 검사가 아직 없어서 건너뛰어요.
const baseHasGuard = (() => {
  if (!base) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `origin/${base}:scripts/check-design.mjs`], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
})();
if (author && base && baseHasGuard) {
  const changed = execFileSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const touched = changed.filter((f) => DESIGN_PATHS.some((p) => f === p || f.startsWith(p)));
  if (touched.length && !DESIGN_OWNERS.includes(author)) {
    errors.push(
      `디자인 파일은 ${DESIGN_OWNERS.join(', ')}만 바꿔요. 바꿔야 하면 서현에게 요청해 주세요.\n` +
        touched.map((f) => `  - ${f}`).join('\n'),
    );
  }
}

// 2. 기능 폴더의 직접 적은 색
const featuresDir = join(root, 'apps/mobile/features');
const COPY_FILES = /^(look|tokens|design|colors|theme)\.tsx?$/;
const COLOR = /['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))['"`]/;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    const rel = relative(root, path).replaceAll('\\', '/');
    if (COPY_FILES.test(name)) {
      warnings.push(`${rel}: 디자인 토큰 복사본이에요. @noteapp/ui와 className으로 바꿔 주세요.`);
      continue;
    }
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const m = line.match(COLOR);
        if (m)
          warnings.push(`${rel}:${i + 1}: 색 ${m[1]}을 직접 적었어요. className 토큰을 써 주세요.`);
      });
  }
}
walk(featuresDir);

const ci = !!process.env.GITHUB_ACTIONS;
if (STRICT_COLORS) errors.push(...warnings);
else if (warnings.length) {
  for (const w of warnings) console.log(ci ? `::warning::${w}` : `경고 ${w}`);
  console.log(`디자인 경고 ${warnings.length}개 (#33 3단계에서 고쳐요)`);
}

if (errors.length) {
  for (const e of errors) console.error(ci ? `::error::${e.replaceAll('\n', '%0A')}` : e);
  process.exit(1);
}
console.log('디자인 검사 통과');
