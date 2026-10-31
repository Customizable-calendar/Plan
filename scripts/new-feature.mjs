// 새 기능 폴더를 만들고 앱에 붙여요.
// 사용: node scripts/new-feature.mjs <id> --owner <A|B|C|D> [--tab <제목>] [--section] [--screen <제목>] [--modal]
// 예:   node scripts/new-feature.mjs search --owner C --tab 검색 --section
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'apps/mobile');

const args = process.argv.slice(2);
const id = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const owner = opt('owner');
const tab = opt('tab');
const section = opt('section') === true;
const screenTitle = opt('screen');
const modal = opt('modal') === true;

function fail(msg) {
  console.error(`오류: ${msg}`);
  console.error(
    '사용: node scripts/new-feature.mjs <id> --owner <A|B|C|D> [--tab <제목>] [--section] [--screen <제목>] [--modal]',
  );
  process.exit(1);
}

if (!id || !/^[a-z][a-z0-9-]*$/.test(id))
  fail('id는 영어 소문자·숫자·- 로 써요. 예: search, ai-draft');
if (!['A', 'B', 'C', 'D'].includes(owner)) fail('--owner A|B|C|D 가 필요해요.');
if (!tab && !section && !screenTitle) fail('--tab, --section, --screen 중 하나 이상 골라요.');
if (tab === true || screenTitle === true) fail('--tab, --screen 뒤에 화면 제목을 써요.');

const dir = join(mobile, 'features', id);
if (existsSync(dir)) fail(`features/${id} 가 이미 있어요.`);

const Pascal = id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const files = {};
const exports = [];
const manifest = [`  id: '${id}',`, `  owner: '${owner}',`];

const placeholder = (variant, title) => `import { ComingSoon } from '@noteapp/ui';

import { useItems } from './data';

export function ${Pascal}${variant === 'screen' ? 'Screen' : 'Section'}() {
  const { items, loading } = useItems();
  // TODO(${owner}): items로 화면을 그려요. 다 만들면 ComingSoon을 지워요.
  return (
    <ComingSoon
      variant="${variant}"
      title="${title}"
      description={loading ? '불러오는 중' : \`항목 \${items.length}개\`}
      owner="${owner}"
    />
  );
}
`;

if (tab || screenTitle) {
  files[`${Pascal}Screen.tsx`] = placeholder('screen', tab || screenTitle);
  exports.push(`export { ${Pascal}Screen } from './${Pascal}Screen';`);
}
if (section) {
  files[`${Pascal}Section.tsx`] = placeholder('section', tab || screenTitle || id);
  exports.unshift(`import { ${Pascal}Section } from './${Pascal}Section';\n`);
  exports.push(`export { ${Pascal}Section };`);
}
if (tab)
  manifest.push(
    `  tab: { title: '${tab}', icon: { ios: 'circle', android: 'circle', web: 'circle' }, order: 50 },`,
  );
if (section) manifest.push(`  todaySection: { Component: ${Pascal}Section, order: 50 },`);
if (screenTitle)
  manifest.push(
    `  screens: [{ route: '${id}', title: '${screenTitle}'${modal ? ', modal: true' : ''} }],`,
  );

files['data.ts'] = `import { useEffect, useState } from 'react';

import { dataSource, fromFixture } from '@/lib/data-source';

// 이 기능의 데이터는 여기서만 가져와요. 화면은 아래 함수·훅만 써요.
// M1: 예시 데이터. M2: dataSource === 'supabase'일 때 getSupabase()로 바꿔요. 화면은 그대로예요.
// 다른 기능과 주고받는 타입이면 packages/shared/src/types에 두고 예시 JSON도 함께 추가해요.
export interface ${Pascal}Item {
  id: string;
  title: string;
}

const sample: ${Pascal}Item[] = [{ id: '1', title: '예시 항목' }];

export async function list${Pascal}Items(): Promise<${Pascal}Item[]> {
  if (dataSource === 'fixtures') return fromFixture(sample);
  throw new Error('${id}: Supabase 연결은 M2에서 만들어요.');
}

export function useItems() {
  const [items, setItems] = useState<${Pascal}Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    list${Pascal}Items()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  return { items, loading };
}
`;

files['index.ts'] =
  `// 이 기능이 밖으로 내보내는 것만 적어요. \`feature\`는 앱에 붙는 위치예요 (lib/feature.ts).
import { defineFeature } from '@/lib/feature';

${exports.join('\n')}

export const feature = defineFeature({
${manifest.join('\n')}
});
`;

files['README.md'] = `# ${tab || screenTitle || id}

- **담당**: ${owner}
- **하는 일**:
- **화면**: ${[tab && '탭', section && '오늘 화면 섹션', screenTitle && `\`/${id}\``].filter(Boolean).join(', ')}
- **데이터**: \`data.ts\` (M1 예시 데이터)
- **다른 기능에 주는 것**:
- **받는 것**:

## M1 할 일

- [ ] 예시 데이터로 화면 만들기
`;

mkdirSync(dir, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);

// 라우트 파일: Expo Router는 app/ 아래 파일 이름이 주소예요.
const route = tab
  ? join(mobile, 'app/(tabs)', `${id}.tsx`)
  : screenTitle
    ? join(mobile, 'app', `${id}.tsx`)
    : null;
if (route) {
  writeFileSync(
    route,
    `// 라우트 파일은 기능 폴더의 화면을 연결만 해요.\nexport { ${Pascal}Screen as default } from '@/features/${id}';\n`,
  );
}

const registry = join(mobile, 'features/registry.ts');
const v = id.replace(/-/g, '');
writeFileSync(
  registry,
  readFileSync(registry, 'utf8')
    .replace(
      '// new-feature:import',
      `import { feature as ${v} } from './${id}';\n// new-feature:import`,
    )
    .replace('  // new-feature:entry', `  ${v},\n  // new-feature:entry`),
);

console.log(`만들었어요: apps/mobile/features/${id}/ (${Object.keys(files).join(', ')})`);
if (route) console.log(`라우트: ${route.slice(root.length + 1).replace(/\\/g, '/')}`);
console.log('등록: apps/mobile/features/registry.ts');
if (tab) console.log('탭 아이콘은 index.ts의 tab.icon을 SF Symbols / Material 이름으로 바꿔요.');
