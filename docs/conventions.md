# 컨벤션

## 브랜치

| 브랜치               | 용도                            | 규칙                                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `main`               | 운영용. 운영 전까지 배포 안 함  | 보호. stage에서만 합쳐요(마일스톤 끝). 태그 `v0.1`, `v0.2` …                   |
| `stage`              | 통합 + stage 배포 (기본 브랜치) | 보호. PR로만 합치고 CI 통과·최신 rebase가 필수예요. 머지되면 stage에 자동 배포 |
| `feat/<기능>/<설명>` | 기능 개발                       | 예: `feat/cards/confirm-button`. 3일 안에 합치기                               |
| `fix/<기능>/<설명>`  | 버그 수정                       | 예: `fix/calendar/timezone`                                                    |
| `contract/<설명>`    | 공통 타입 변경                  | `packages/shared`만 바꿔요. 승인 2명                                           |

## 커밋

`<종류>(<기능>): <한글 설명>` 형식이에요. 종류는 feat · fix · contract · refactor · test · docs · chore 7가지예요.

```
feat(cards): 카드 확인 버튼 추가
fix(calendar): 종일 일정이 하루 밀리는 문제
contract(shared): Card에 dueAt 필드 추가
docs(learning): Expo Router 탭 구조 정리
```

## PR

- 대상은 `stage`, 리뷰 1명 승인(CODEOWNERS가 자동 지정), 합칠 때는 Squash merge예요. 배포는 [deploy.md](deploy.md)
- 올리기 전에 `pnpm pr:check`로 stage 최신 여부와 겹치는 PR을 확인해요(아래 "충돌 처리").
- 한 PR에는 기능 하나, 400줄 이하를 권장해요. 길어지면 "화면만", "데이터만"으로 나눠요.
- 탭·라우트·`package.json` 같은 공유 파일 변경은 따로 작은 PR로 올려요. 충돌은 대부분 여기서 나요.
- 작업 중인 기능은 화면에서 숨긴 채 먼저 합쳐도 돼요.
- 리뷰 순서: AI 리뷰로 1차 점검 → 팀원 1명이 확인 후 승인
- 깨지는 변경(필드 삭제·이름 변경)은 PR 제목에 `[breaking]`을 붙여요.

## 충돌 처리

PR을 올리기 전에 하고, 리뷰 중에 stage가 바뀌어도 다시 해요. AI 도구에 맡길 때도 같은 순서예요(AGENTS.md).

1. `pnpm pr:check`: stage보다 뒤처졌는지, 열린 PR 중 같은 파일을 고치는 PR이 있는지 보여줘요.
2. 뒤처졌으면 rebase해요.
   ```bash
   git fetch origin
   git rebase origin/stage        # 충돌 나면 파일을 고치고 git add → git rebase --continue
   pnpm lint && pnpm typecheck && pnpm test
   git push --force-with-lease    # 내 브랜치에만. stage·main에는 절대 안 해요
   ```
3. 겹치는 PR이 있으면 PR 본문 "겹치는 PR"에 번호를 적고, 어느 쪽을 먼저 머지할지 작성자끼리 정해요. 나중에 머지하는 쪽이 rebase해요.

자주 나는 충돌

| 파일                           | 처리                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `pnpm-lock.yaml`               | 직접 고치지 않아요. stage 쪽을 받고(rebase 중이면 `git checkout --ours pnpm-lock.yaml`) `pnpm install` 후 add |
| 탭·라우트·`package.json`       | 양쪽 줄을 모두 살려요. 애초에 따로 작은 PR로 올려요                                                           |
| 마이그레이션 타임스탬프가 앞섬 | 아직 머지 안 된 내 파일을 `npx supabase migration new`로 새로 만들어 내용을 옮겨요                            |
| `database.types.ts`            | 직접 고치지 않아요. rebase 뒤 `npx supabase db reset && pnpm db:types`로 다시 만들어요                        |
| 남의 기능 폴더                 | 내 쪽에서 고치지 않고 담당자에게 물어요                                                                       |

rebase 중 `git checkout --theirs`/`--ours`는 merge 때와 반대예요. rebase에서는 `--ours`가 stage, `--theirs`가 내 커밋이에요. 헷갈리면 `git rebase --abort`로 처음 상태로 돌아가요.

## DB와 타입

- 테이블 모양은 마이그레이션 → `pnpm db:types`로 만든 `packages/shared/src/db/database.types.ts`가 기준이에요. 손으로 고치지 않아요.
- 앱 타입(`packages/shared/src/types/`)과는 `packages/shared/src/db/mappers/`로 이어요. 자세한 순서는 [packages/shared/src/db/README.md](../packages/shared/src/db/README.md)

## 이름

- 컴포넌트 파일: `PascalCase.tsx` (예: `CardsScreen.tsx`)
- 그 밖의 파일: `camelCase.ts`, 폴더: `kebab-case`
- 테이블: `<영역>_<이름>` (예: `cards_cards`, `exec_records`), 컬럼: `snake_case`
- 마이그레이션: `<타임스탬프>_<영역>_<설명>.sql`

## 데이터와 시간

- 시각은 UTC ISO 8601 문자열로 저장하고, 시간대는 IANA 이름(Asia/Seoul)으로 따로 둬요.
- 종일 일정은 시각으로 바꾸지 않고 날짜로 다뤄요.

## 언어

- 화면 글자는 한국어, 코드 이름은 영어로 써요. 주석과 문서는 한국어로 써도 돼요.
- 오류 메시지는 무엇이 잘못됐고 어떻게 고치는지 적어요. 예: "AI 키가 없어요. 설정에서 키를 먼저 저장해 주세요."
