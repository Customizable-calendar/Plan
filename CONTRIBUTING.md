# noteApp (가안)

막 쓴 메모를 일정·할 일·사람·아이디어 카드로 나누고, 확인한 카드로 업무일지 같은 문서를 만들고, 구글 캘린더와 이어주는 모바일 앱이에요.
앱 개발이 처음인 4명이 AI 바이브 코딩으로 공부하며 만드는 사이드 프로젝트예요. 이름·범위·기술은 언제든 바뀔 수 있어요.

## 핵심 흐름

1. **모으기**: 막 쓴 메모, 구글 캘린더 일정
2. **카드로 나누기**: 일정·할 일·사람·아이디어를 제안하고 사용자가 확인
3. **AI 초안**: 확인한 카드로 세션 템플릿(업무일지 등) 문서 작성, 내 API 키 사용
4. **다듬기**: 편집기에서 직접 수정
5. **나누기**: 피드에 공유 (P1)

## 처음 실행하기

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # Supabase URL과 publishable 키 채우기
pnpm dev                                        # Expo 개발 서버, 폰의 Expo Go로 QR 스캔
```

Node 22.13 이상(또는 24)과 pnpm 10이 필요해요. pnpm이 없으면 `corepack enable`을 먼저 실행하세요.
커밋 전에는 `pnpm lint && pnpm typecheck && pnpm test`가 통과해야 해요.

## 폴더

| 폴더                 | 내용                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `apps/mobile`        | Expo 앱. `app/`은 화면 라우트, `features/`는 기능별 코드, `lib/`는 Supabase·로그인·키 보관 |
| `packages/shared`    | 기능끼리 주고받는 타입, 예시 JSON, 세션 템플릿 JSON                                        |
| `packages/extractor` | 메모에서 카드를 찾는 규칙 + AI 추출                                                        |
| `packages/ai-client` | Claude·OpenAI·Gemini 호출 어댑터 (사용자 키)                                               |
| `packages/storage`   | 파일 저장소 인터페이스 (지금 Supabase, 나중에 S3)                                          |
| `packages/ui`        | 색·글꼴·공통 컴포넌트                                                                      |
| `supabase`           | DB 마이그레이션, Edge Functions                                                            |
| `docs`               | 컨벤션, 로드맵, 결정 기록, 프롬프트·학습 기록                                              |

## 담당

| 담당 | 영역                                                     |
| ---- | -------------------------------------------------------- |
| A    | 기록·문서: 막 쓰기 입력, 세션 템플릿, 편집기             |
| B    | AI·카드: 카드 추출, 카드로 AI 초안                       |
| C    | 캘린더: 구글 연결, 캘린더 화면, 시간 잡기, 수행 확인     |
| D    | 기반·공유: 로그인, 탭, 설정, 파일 저장, CI, PM, 피드(P1) |

마일스톤과 첫 할 일은 [docs/roadmap.md](docs/roadmap.md)에 있어요.

## 먼저 읽을 것

- [AGENTS.md](AGENTS.md): AI 코딩 도구와 사람 모두를 위한 공용 규칙
- [docs/conventions.md](docs/conventions.md): 브랜치·커밋·PR·이름 규칙
- [docs/decisions/](docs/decisions/): 왜 이렇게 정했는지
- [docs/setup-github.md](docs/setup-github.md): GitHub 레포 세팅 순서

## 라이선스

팀에서 정할 예정이에요. 참고 앱 DayOtter(AGPLv3)의 코드는 가져오지 않고 구조만 참고해요.
