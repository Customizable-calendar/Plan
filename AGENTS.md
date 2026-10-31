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
- 기능은 `index.ts`의 `feature`로 탭·오늘 섹션·화면에 붙어요. 새 기능은 `node scripts/new-feature.mjs`로 만들고, 공용 레이아웃(`app/_layout.tsx`, `app/(tabs)/`)은 고치지 않아요. 자세한 건 `apps/mobile/features/README.md`
- 화면은 자기 기능의 `data.ts`로만 데이터를 가져와요. 예시 JSON ↔ Supabase 전환은 `data.ts` 안에서만 해요.
- 기능끼리 주고받는 타입은 `packages/shared`에만 정의해요. 바꿀 때는 예시 JSON도 함께 고치고 `contract` 라벨 PR로 올려요.
- Supabase는 `@/lib/supabase`의 `getSupabase()`로만, 로그인은 `@/lib/auth`로만 써요.
- 파일 업로드·다운로드는 `@noteapp/storage`의 `FileStorage`로만 해요.
- AI 호출은 `@noteapp/ai-client`로만 해요. 사용자 AI 키는 `@/lib/secrets`(기기 보안 저장소)에만 두고, 서버·DB·로그로 보내지 않아요.

## 데이터

- 테이블 이름 앞에 영역을 붙여요: `notes_`, `docs_`, `cards_`, `calendar_`, `exec_`, 그리고 공용 `profiles`, `files`
- 모든 테이블에 RLS를 켜고 `user_id = auth.uid()` 정책부터 시작해요.
- 마이그레이션 파일은 `supabase/migrations/<타임스탬프>_<영역>_<설명>.sql`이에요. 이미 합친 파일은 고치지 않고 새 파일을 만들어요.
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

- 브랜치: `feat/<기능>/<설명>`, `fix/<기능>/<설명>`, `contract/<설명>`
- 커밋: `<종류>(<기능>): <한글 설명>`. 종류는 feat · fix · contract · refactor · test · docs · chore
- 끝내기 전에 `pnpm lint && pnpm typecheck && pnpm test`를 통과시켜요.
- 코드를 만든 뒤에는 무엇을 왜 바꿨는지 짧게 설명해요. 사람이 PR 템플릿의 "내가 이해한 것"을 채울 수 있게요.
- UI 글자는 한국어, 코드의 이름(변수·함수·파일)은 영어로 써요. 주석은 한국어로 써도 돼요.
