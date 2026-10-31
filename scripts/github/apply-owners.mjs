// .github/team.json의 아이디로 CODEOWNERS의 @member-a ~ @member-d를 바꿔요.
// 실행: node scripts/github/apply-owners.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const team = JSON.parse(readFileSync('.github/team.json', 'utf8'));
const roles = ['a', 'b', 'c', 'd'];
const empty = roles.filter((r) => !team[r]?.trim());
if (empty.length > 0) {
  console.error(`team.json에 아이디가 비어 있어요: ${empty.join(', ')}`);
  process.exit(1);
}

let text = readFileSync('.github/CODEOWNERS', 'utf8');
for (const r of roles) {
  const id = team[r].trim().replace(/^@/, '');
  text = text.replaceAll(`@member-${r}`, `@${id}`);
}
writeFileSync('.github/CODEOWNERS', text);
console.log('CODEOWNERS를 바꿨어요. git diff로 확인한 뒤 PR로 올려 주세요.');
