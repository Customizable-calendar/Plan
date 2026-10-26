# @noteapp/shared

기능끼리 주고받는 데이터의 "약속"이 모인 곳이에요. 처음에는 OpenAPI 대신 TypeScript 타입과 예시 JSON으로 약속해요.

| 폴더             | 내용                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `src/types/`     | Note, Card, Template, Document, CalendarEvent, ExecutionRecord, FileMeta 타입 |
| `src/fixtures/`  | 예시 데이터. Supabase 연결 전에 각자 이 데이터로 화면을 만들어요.             |
| `src/templates/` | 세션 양식 JSON. 코딩 없이 파일 하나로 새 양식을 추가할 수 있어요.             |

## 바꿀 때 규칙

- 타입을 바꾸는 PR은 `contract/<설명>` 브랜치, `contract` 라벨, 승인 2명이에요.
- 타입을 바꾸면 예시 JSON도 같은 PR에서 맞춰요. `pnpm test`가 둘이 맞는지 검사해요.
- 필드 삭제·이름 변경처럼 깨지는 변경은 PR 제목에 `[breaking]`을 붙이고 회의에서 공유해요.
