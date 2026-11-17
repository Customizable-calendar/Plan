#!/usr/bin/env node
// 지금 코드가 이미 있는 stage APK로 업데이트를 받을 수 있는지 봐요. (Android)
// 네이티브 부분(라이브러리, app.json 권한·플러그인, SDK)이 바뀌면 fingerprint가 달라져서
// 예전 APK는 새 업데이트를 안 받아요. 그때는 APK를 새로 빌드해야 해요.
//
// 출력(GITHUB_OUTPUT이 있으면 거기에도): runtime=<fingerprint>, needs_build=true|false, build_url=<있으면>
// 필요: EXPO_TOKEN(또는 eas login), pnpm install이 끝난 상태
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const mobile = new URL('../apps/mobile/', import.meta.url);
const sh = (line) =>
  execSync(line, { cwd: mobile, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const resolved = JSON.parse(sh('npx expo-updates runtimeversion:resolve --platform android'));
const runtime = resolved.runtimeVersion;

// 끝났거나 만드는 중인 stage 빌드 중에 같은 fingerprint가 있으면 새로 안 만들어요.
const builds = JSON.parse(
  sh(
    `npx -y eas-cli@latest build:list --platform android --channel stage --runtime-version ${runtime} ` +
      '--limit 10 --json --non-interactive',
  ) || '[]',
);
const usable = builds.find((b) =>
  ['FINISHED', 'IN_PROGRESS', 'IN_QUEUE', 'NEW'].includes(b.status),
);
const needsBuild = !usable;
const buildUrl = usable
  ? `https://expo.dev/accounts/${usable.project?.ownerAccount?.name ?? 'choengs-team'}/projects/${usable.project?.slug ?? 'noteapp'}/builds/${usable.id}`
  : '';

console.log(`runtime=${runtime}`);
console.log(`needs_build=${needsBuild}`);
if (usable) console.log(`build (${usable.status}): ${buildUrl}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `runtime=${runtime}\nneeds_build=${needsBuild}\nbuild_url=${buildUrl}\n`,
  );
}
