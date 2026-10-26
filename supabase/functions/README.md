# functions (Edge Functions)

비밀키가 필요한 일만 여기서 해요. 앱에서 직접 할 수 있는 일은 여기로 옮기지 않아요.

| 함수 (예정)       | 담당 | 하는 일                              |
| ----------------- | ---- | ------------------------------------ |
| `google-calendar` | C    | 구글 OAuth 토큰 보관, 일정 읽기·쓰기 |
| `process-file`    | D    | 업로드한 파일 후처리 (P1)            |

- 새 함수는 `npx supabase functions new <이름>`으로 만들어요. Deno로 실행돼요.
- 비밀값은 `npx supabase secrets set KEY=값`으로 넣고, 코드나 `.env.example`에 적지 않아요.
