// 기능 등록이 맞는지 검사해요. apps/mobile의 test로 CI에서 돌아요.
// - 모든 기능 폴더가 registry.ts에 있고, id가 폴더 이름과 같은지
// - tab이 있으면 app/(tabs)/<id>.tsx, screens가 있으면 app/<route>.tsx가 있는지
// - id·라우트가 겹치지 않는지
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '../apps/mobile');
const featuresDir = join(mobile, 'features');
const registry = readFileSync(join(featuresDir, 'registry.ts'), 'utf8');
const errors = [];
const routes = new Set();

const folders = readdirSync(featuresDir).filter((n) =>
  statSync(join(featuresDir, n)).isDirectory(),
);

for (const folder of folders) {
  const where = `features/${folder}`;
  const indexPath = join(featuresDir, folder, 'index.ts');
  if (!existsSync(indexPath)) {
    errors.push(`${where}: index.ts가 없어요.`);
    continue;
  }
  const src = readFileSync(indexPath, 'utf8');
  if (!src.includes('defineFeature(')) {
    errors.push(`${where}/index.ts: export const feature = defineFeature({...})가 없어요.`);
    continue;
  }
  const id = src.match(/\bid:\s*'([^']+)'/)?.[1];
  if (id !== folder) errors.push(`${where}/index.ts: id '${id}'가 폴더 이름 '${folder}'와 달라요.`);
  if (!registry.includes(`from './${folder}'`))
    errors.push(`${where}: features/registry.ts에 등록되지 않았어요.`);

  if (/\btab:\s*\{/.test(src) && !existsSync(join(mobile, 'app/(tabs)', `${folder}.tsx`)))
    errors.push(`${where}: tab이 있는데 app/(tabs)/${folder}.tsx가 없어요.`);

  for (const [, route] of src.matchAll(/route:\s*'([^']+)'/g)) {
    if (routes.has(route)) errors.push(`${where}: 라우트 '${route}'가 다른 기능과 겹쳐요.`);
    routes.add(route);
    if (!existsSync(join(mobile, 'app', `${route}.tsx`)))
      errors.push(`${where}: screens의 '${route}'에 맞는 app/${route}.tsx가 없어요.`);
  }
}

if (errors.length) {
  console.error(`기능 등록 검사 실패 (${errors.length}개)\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`기능 등록 검사 통과: ${folders.length}개`);
