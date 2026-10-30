# 배포 (담당: D)

## 흐름

```
각자 로컬 (pnpm dev → Expo Go)
   │  PR (CI: check, db-types 통과 + 승인 1명, stage 최신 위로 rebase)
   ▼
stage 브랜치 ──머지되면 GitHub Actions(deploy-stage.yml)──▶ stage 환경
   │                                                       ├─ Supabase stage 프로젝트: 마이그레이션 적용, Edge Functions 배포
   │                                                       └─ 앱: EAS Update로 stage 채널에 올림
   ▼
main 브랜치: 운영 전까지 배포하지 않아요. 마일스톤이 끝나면 stage를 합치고 태그(v0.1 …)만 남겨요.
```

- dev 환경은 따로 두지 않아요. 머지 전 확인은 각자 로컬 화면(Expo Go)으로 해요.
- stage에서 확인하려면 폰에 **stage 빌드**를 한 번 깔아 둬요. 그 뒤로는 머지될 때마다 앱을 다시 열면 새 코드를 받아요.
- 네이티브 라이브러리를 추가하거나 `app.json`을 크게 바꾸면 기존 stage 빌드가 업데이트를 못 받아요. 그때는 D가 stage 빌드를 다시 만들어 공유해요.

## 1. 환경과 값

| 이름                       | 종류(GitHub `stage` 환경) | 어디서 얻나                                           |
| -------------------------- | ------------------------- | ----------------------------------------------------- |
| `SUPABASE_PROJECT_REF`     | Variable                  | stage 프로젝트 주소 `https://<ref>.supabase.co`의 ref |
| `SUPABASE_ACCESS_TOKEN`    | Secret                    | Supabase 계정 → Access Tokens                         |
| `SUPABASE_DB_PASSWORD`     | Secret                    | stage 프로젝트 만들 때 정한 DB 비밀번호               |
| `EXPO_PUBLIC_SUPABASE_URL` | Variable                  | stage 프로젝트 → Project Settings → API               |
| `EXPO_PUBLIC_SUPABASE_KEY` | Variable                  | 같은 곳의 publishable(anon) 키. service_role은 금지   |
| `EXPO_TOKEN`               | Secret                    | expo.dev → Account settings → Access tokens           |

```bash
gh variable set SUPABASE_PROJECT_REF --env stage --body "<ref>"
gh secret set SUPABASE_ACCESS_TOKEN --env stage
gh secret set SUPABASE_DB_PASSWORD --env stage
gh variable set EXPO_PUBLIC_SUPABASE_URL --env stage --body "https://<ref>.supabase.co"
gh variable set EXPO_PUBLIC_SUPABASE_KEY --env stage --body "<publishable 키>"
gh secret set EXPO_TOKEN --env stage
```

값이 없는 단계는 워크플로가 건너뛰고 안내만 남겨요. 그래서 설정 전에 머지해도 실패하지 않아요.

## 2. Supabase stage 프로젝트

1. supabase.com에서 팀 조직 아래 `noteapp-stage` 프로젝트를 만들어요(무료 요금제).
2. 위 표의 Supabase 값 3개를 넣어요.
3. Edge Function 비밀값(구글 OAuth 등)은 `npx supabase secrets set KEY=값 --project-ref <ref>`로 넣어요. GitHub에는 넣지 않아요.
4. 마이그레이션은 사람이 직접 적용하지 않아요. stage에 머지되면 `supabase db push`가 아직 안 된 파일만 적용해요.

## 3. EAS (앱 업데이트)

처음 한 번, D가 Expo 계정으로 해요. 아래 명령이 `app.json`·`package.json`·lockfile을 바꾸니 `chore(infra)` PR 하나로 올려요.

```bash
cd apps/mobile
pnpm exec expo install expo-updates
npx eas-cli login
npx eas-cli init               # app.json에 projectId가 들어가요
npx eas-cli update:configure   # app.json에 updates.url, runtimeVersion이 들어가요
```

- `runtimeVersion`은 `{ "policy": "fingerprint" }`로 둬요. 네이티브 쪽이 바뀌면 값이 바뀌어서, 맞지 않는 빌드에 업데이트가 가지 않아요.
- `EXPO_TOKEN`을 넣으면 다음 머지부터 앱 업데이트가 올라가요.

## 4. stage 빌드 나눠 주기

```bash
cd apps/mobile
npx eas-cli build --profile stage --platform android   # 끝나면 설치 링크(QR)가 나와요
npx eas-cli build --profile stage --platform ios       # Apple 개발자 계정과 기기 등록이 필요해요
```

- Android는 링크로 바로 설치돼요.
- iOS는 Apple 개발자 계정(유료)이 있어야 하고, `npx eas-cli device:create`로 팀원 기기를 먼저 등록해요. 계정이 없으면 iOS 팀원은 stage 대신 로컬(Expo Go)로 확인해요.

## 5. main (운영)

- 운영 전까지 main에서는 배포하지 않아요. `deploy-stage.yml`만 있어요.
- 운영을 시작할 때 Supabase production 프로젝트, `production` 환경, `deploy-production.yml`(스토어 빌드·제출)을 따로 만들어요. 그때 결정 기록을 남겨요.
