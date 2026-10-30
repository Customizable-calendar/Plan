# AGENTS.md

Claude Code, Codex, Cursor 등 어떤 AI 코딩 도구를 쓰든 이 파일을 먼저 읽어요. 사람도 같은 규칙을 따라요.
`CLAUDE.md`는 이 파일을 불러오기만 해요. 규칙을 바꿀 때는 이 파일만 고쳐요.

## 프로젝트

- **무엇**: 막 쓴 메모를 일정·할 일·사람·아이디어 카드로 나누고, 확인한 카드로 업무일지 같은 문서를 만들고, 구글 캘린더와 이어주는 모바일 앱
- **팀**: 앱 개발이 처음인 4명이 AI 바이브 코딩으로 공부하며 만들어요. 코드는 짧고 읽기 쉽게 쓰고, 새 개념을 쓰면 주석으로 한 줄 설명해요.
- **지금 단계**: 1단계 (Expo 앱 + Supabase 직접). NestJS 서버, 오프라인 동기화, OpenAPI는 아직 만들지 않아요. 이유는 `docs/decisions/0001-stack.md`

## 스택

- 앱: Expo SDK 58, Expo Router, React Native, TypeScript (strict)
- 데이터·로그인·파일: Supabase를 앱에서 직접 사용, 모든 테이블에 RLS
- 비밀키가 필요한 일: `supabase/functions/` (Edge Functions)
- 패키지: pnpm 워크스페이스. Expo 라이브러리는 `cd apps/mobile && pnpm exec expo install <이름>`으로 추가

## 폴더와 경계

- `apps/mobile/app/`은 화면 라우트예요. 조립만 하고 로직은 `features/<기능>/`에 둬요.
- 다른 기능 폴더의 내부 파일을 import하지 않아요. `@/features/<기능>`(index.ts)로 내보낸 것만 써요. ESLint가 막아요.
- 작업할 기능 폴더의 `README.md`를 먼저 읽어요. 담당자, 범위, 데이터, 할 일이 있어요.
- 기능끼리 주고받는 타입은 `packages/shared`에만 정의해요. 바꿀 때는 예시 JSON도 함께 고치고 `contract` 라벨 PR로 올려요.
- Supabase는 `@/lib/supabase`의 `getSupabase()`로만, 로그인은 `@/lib/auth`로만 써요.
- 파일 업로드·다운로드는 `@noteapp/storage`의 `FileStorage`로만 해요.
- AI 호출은 `@noteapp/ai-client`로만 해요. 사용자 AI 키는 `@/lib/secrets`(기기 보안 저장소)에만 두고, 서버·DB·로그로 보내지 않아요.

## 데이터

- 테이블 이름 앞에 영역을 붙여요: `notes_`, `docs_`, `cards_`, `calendar_`, `exec_`, 그리고 공용 `profiles`, `files`
- 모든 테이블에 RLS를 켜고 `user_id = auth.uid()` 정책부터 시작해요.
- 마이그레이션 파일은 `supabase/migrations/<타임스탬프>_<영역>_<설명>.sql`이에요. 이미 합친 파일은 고치지 않고 새 파일을 만들어요.
- 마이그레이션을 바꾸면 `pnpm db:types`로 `packages/shared/src/db/database.types.ts`를 다시 만들고, `packages/shared/src/db/mappers/`도 맞춰요. 생성 파일은 손으로 고치지 않아요.
- 기능 코드는 Supabase 응답을 그대로 쓰지 않고 mapper로 앱 타입으로 바꿔서 써요.
- 시각은 UTC ISO 8601로 저장하고, 시간대(IANA, 예: Asia/Seoul)는 따로 저장해요.

## AI 결과를 다루는 원칙 (앱 기능)

- AI·규칙이 만든 카드·일정·문서는 "제안"으로 보여주고, 사용자가 확인해야 저장해요.
- 사용자가 쓴 원문은 고치지 않고, 카드마다 원문 위치와 출처를 남겨요.
- 규칙으로 잡히는 건 규칙으로 먼저 처리하고, 애매한 것만 AI로 보내요.
- AI에 없는 사실이나 수치를 지어내게 하지 않아요.

## 하지 말 것

- `.env`, API 키, 토큰을 커밋하거나 코드에 적지 않아요. Supabase service_role·secret 키는 앱에 절대 넣지 않아요.
- 새 라이브러리를 말없이 추가하지 않아요. 추가하면 PR 본문에 이유를 적어요.
- 한 PR에 여러 기능을 섞지 않아요. 400줄 이하를 권장해요.
- 타입 오류를 `any`나 `@ts-ignore`로 덮거나, 테스트를 끄지 않아요.
- 다른 사람이 맡은 기능 폴더를 크게 고치지 않아요. 필요하면 이슈로 먼저 이야기해요.

## 작업 방식

- 브랜치: `feat/<기능>/<설명>`, `fix/<기능>/<설명>`, `contract/<설명>`. 모두 `stage`에서 따고 `stage`로 PR을 올려요.
- 커밋: `<종류>(<기능>): <한글 설명>`. 종류는 feat · fix · contract · refactor · test · docs · chore
- 끝내기 전에 `pnpm lint && pnpm typecheck && pnpm test`를 통과시켜요.
- 코드를 만든 뒤에는 무엇을 왜 바꿨는지 짧게 설명해요. 작성자가 이해하고 PR 본문 "무엇을 했나요"에 적을 수 있게요.
- UI 글자는 한국어, 코드의 이름(변수·함수·파일)은 영어로 써요. 주석은 한국어로 써도 돼요.

## PR을 올리기 전 (AI 도구가 꼭 하는 일)

PR을 만들거나 PR 본문을 쓰기 전에 아래를 순서대로 해요. 건너뛰지 않아요.

1. `pnpm pr:check`를 실행해요. stage보다 뒤처졌는지, 열린 PR 중 같은 파일을 고치는 PR이 있는지 나와요.
2. 뒤처졌으면 `git fetch origin && git rebase origin/stage`. 충돌은 `docs/conventions.md`의 "충돌 처리" 표대로 풀고, 풀고 나서 lint·typecheck·test를 다시 돌려요.
3. 겹치는 PR이 있으면 `gh pr diff <번호>`로 그 PR이 무엇을 바꾸는지 읽고, 사람에게 겹치는 부분과 권하는 머지 순서를 알려요. PR 본문 "겹치는 PR"에 적어요.
4. 다른 사람의 PR 브랜치에 push하거나, 그 PR에 맞추려고 남의 기능 폴더를 고치지 않아요.
5. `git push --force-with-lease`는 내 브랜치에만 써요. `stage`·`main`에는 force push하지 않아요.
