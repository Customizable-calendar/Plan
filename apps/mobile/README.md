# apps/mobile

Expo(React Native) 앱이에요. 루트에서 `pnpm dev`로 실행해요.

| 폴더               | 하는 일                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `app/`             | 화면 라우트 (Expo Router). 조립만 하고 로직은 두지 않아요.                                         |
| `features/<기능>/` | 기능별 화면·로직. 밖으로는 `index.ts`로 내보낸 것만 써요. 폴더마다 README에 담당과 할 일이 있어요. |
| `lib/`             | Supabase 클라이언트, 로그인, AI 키 보관. 외부 서비스는 여기를 거쳐요.                              |

Expo 라이브러리를 추가할 때는 SDK와 맞는 버전이 설치되도록 `pnpm exec expo install <이름>`을 써요.

## 로컬에서 띄우기

dev 서버는 따로 없어요. 각자 컴퓨터에서 앱과 Supabase를 띄우고, 폰이나 시뮬레이터로 확인한 뒤 `stage`로 PR을 올려요.

### 1. 공통 준비 (처음 한 번)

| 필요한 것                | 설치                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Node 22.13 이상, pnpm 10 | `corepack enable` 후 루트에서 `pnpm install`                            |
| Docker Desktop           | 로컬 Supabase가 Docker로 돌아가요. 켜 둔 상태에서 아래 명령을 실행해요  |
| Expo Go (폰으로 볼 때)   | App Store / Play Store에서 설치. SDK 58을 지원하는 최신 버전이어야 해요 |

### 2. Supabase 고르기

**A. 로컬 Supabase (기본, 키 발급 필요 없음)**

```bash
npx supabase start     # 처음엔 이미지 내려받느라 몇 분 걸려요
npx supabase status    # API URL과 Publishable key가 나와요
```

`apps/mobile/.env`를 만들고 위 값을 넣어요.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```
EXPO_PUBLIC_SUPABASE_URL=http://<주소>:54321
EXPO_PUBLIC_SUPABASE_KEY=<Publishable key>
```

`<주소>`는 앱을 어디서 띄우느냐에 따라 달라요.

| 어디서 보나        | `<주소>`                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| iOS 시뮬레이터     | `127.0.0.1`                                                                 |
| Android 에뮬레이터 | `10.0.2.2` (에뮬레이터에서 내 컴퓨터를 가리키는 주소)                       |
| 실제 폰 (Expo Go)  | 내 컴퓨터의 와이파이 IP. macOS `ipconfig getifaddr en0`, Windows `ipconfig` |

- 마이그레이션을 바꿨으면 `npx supabase db reset`으로 다시 적용해요.
- DB 화면은 `http://127.0.0.1:54323`(Supabase Studio)에서 봐요.
- 다 쓰면 `npx supabase stop`.

**B. stage Supabase에 붙기 (화면만 만들 때)**

- D가 공유한 stage 프로젝트의 URL과 publishable 키를 `.env`에 넣어요. Docker가 필요 없어요.
- stage DB는 모두가 같이 써요. 마이그레이션을 직접 적용하거나 데이터를 지우지 않아요.

### 3. 앱 띄우기

```bash
pnpm dev    # 루트에서. 터미널에 QR과 단축키가 나와요
```

**iOS**

- 시뮬레이터 (Mac만): Xcode를 설치하고 한 번 실행해 둔 뒤, 터미널에서 `i`를 눌러요.
- 실제 iPhone: Expo Go를 설치하고 기본 카메라 앱으로 QR을 찍어요. 컴퓨터와 같은 와이파이여야 해요.
- Windows·Linux에서는 시뮬레이터가 없어서 실제 iPhone + Expo Go로만 봐요.

**Android**

- 에뮬레이터: Android Studio → Device Manager에서 기기를 하나 만들고 켠 뒤, 터미널에서 `a`를 눌러요.
- 실제 폰: Expo Go를 설치하고 Expo Go 앱 안의 "Scan QR code"로 찍어요. 같은 와이파이여야 해요.

**연결이 안 될 때**

- 회사·학교 와이파이처럼 기기끼리 막힌 네트워크면 `pnpm --filter mobile start --tunnel`로 띄워요.
- `.env`를 고친 뒤에는 `pnpm --filter mobile start --clear`로 다시 띄워야 반영돼요.
- 웹(`w`)은 기기 보안 저장소(`expo-secure-store`)가 없어서 AI 키 기능이 동작하지 않아요. 확인은 iOS·Android로 해요.

### 4. Edge Functions (필요한 사람만)

```bash
cp supabase/functions/.env.example supabase/functions/.env   # 구글 OAuth 같은 비밀값. 커밋하지 않아요
npx supabase functions serve --env-file supabase/functions/.env
```

앱에서는 로컬 Supabase 주소의 `/functions/v1/<이름>`으로 불러요.

### 5. Expo Go로 안 되는 것

구글 로그인처럼 네이티브 설정이 필요한 기능은 Expo Go에서 동작하지 않아요. 그 기능을 만들 때 개발 빌드(`expo-dev-client`)를 도입하고 이 문서를 고쳐요.
