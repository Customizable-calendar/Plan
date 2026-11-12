# 로그인

## 방식

이메일로 받은 **6자리 코드**로 로그인해요. 비밀번호는 없어요. 처음 쓰는 이메일이면 계정이 같이 만들어져요.

- 앱: `apps/mobile/lib/auth.ts` (`sendLoginCode`, `verifyLoginCode`, `useSession`, `signOut`, `useMyTeamRole`)
- 화면: `app/login.tsx` → `features/settings/LoginScreen.tsx`, 설정 맨 위 계정 칸(`AccountSection`)
- Supabase를 쓰는 기능이 하나라도 있으면(`EXPO_PUBLIC_DATA_SOURCE=supabase` 또는 `EXPO_PUBLIC_SUPABASE_FEATURES`에 값) 로그인 전에는 로그인 화면만 보여요. 예시 데이터만 쓰면 로그인 없이 돼요.
- 카드처럼 본인 데이터는 RLS `user_id = auth.uid()`로 막아요.

## 팀원만 보는 데이터

개발일지·퀴즈는 `public.team_members`(이메일 → 역할 A~D)에 있는 계정만 읽고, 내 역할로만 써요. DB 함수 `my_team_role()`이 로그인한 이메일로 역할을 찾아요.

레포가 공개라서 **팀원 이메일은 마이그레이션에 적지 않아요.** stage 대시보드 **SQL Editor**에서 한 번 넣어요.

```sql
insert into public.team_members (email, role) values
  ('민성 이메일', 'A'),
  ('준호 이메일', 'B'),
  ('재민 이메일', 'C'),
  ('서현 이메일', 'D');
```

이메일은 소문자로 넣어요. 바꿀 때는 `update public.team_members set email = '...' where role = 'A';`

로컬(`npx supabase start`)에서는 같은 SQL을 `http://127.0.0.1:54323` SQL Editor에서 넣어요.

## stage 대시보드에서 한 번만

1. **Authentication → Emails → Templates**에서 **Magic Link**와 **Confirm signup** 본문에 코드가 보이게 바꿔요. 링크 대신 `{{ .Token }}`을 넣어요.

   ```html
   <h2>노트앱 로그인 코드</h2>
   <p>앱에 아래 6자리 코드를 넣어 주세요. 1시간 동안 쓸 수 있어요.</p>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```

2. **Authentication → Sign In / Providers → Email**에서 **Email OTP Length**를 6으로 둬요. (앱은 6~10자리를 다 받아요. 새 프로젝트 기본값이 8일 수 있어요)
3. **Authentication → Sign In / Providers**에서 **Allow anonymous sign-ins**를 꺼요. (개발용 익명 로그인은 지웠어요)
4. 기본 메일 발송은 시간당 몇 통으로 막혀 있어요. 팀원이 늘거나 코드가 안 오면 **Authentication → Emails → SMTP Settings**에 메일 서버를 붙여요.

## 나중에

- 구글 로그인: Google Cloud OAuth(#6)가 끝나면 더해요. 네이티브 모듈이 들어가서 stage 빌드를 다시 만들어요.
- `profiles`(이름, 시간대 등)는 설정 화면을 만들 때 더해요.
