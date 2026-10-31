# Calendar Hub Native

Go + Walk로 구현한 **Windows Win32 네이티브 GUI**입니다. 독립 데스크톱 창 안의 버튼, 표, 입력창, 체크박스, 설정 대화상자가 모두 Windows 컨트롤입니다. HTML, JavaScript, WebView, 브라우저 GUI를 사용하지 않습니다. OAuth 인증과 원본 일정 링크를 열 때만 시스템 브라우저를 사용합니다.

## 바로 실행

1. ZIP을 전체 해제합니다.
2. `start-demo.cmd`를 실행하면 설정 없이 독립 창에서 샘플 일정을 볼 수 있습니다.
3. 실제 계정은 `calendarhub-native.exe` 또는 `start.cmd`로 실행합니다.
4. 첫 일반 실행에 **캘린더 연결 가이드**가 열립니다. Google 또는 Microsoft를 선택하고 앱 안의 3단계 안내를 따라갑니다.
5. Google은 **Google 설정 JSON 가져오기**로 다운로드 파일을 선택하면 자동 입력됩니다. Microsoft는 안내된 Application client ID를 붙여 넣습니다. **저장 후 로그인**으로 인증을 진행합니다.
6. 창을 닫으면 프로세스와 진행 중인 작업이 종료됩니다. 콘솔은 표시하지 않습니다.

Windows amd64용 실행 파일입니다. Windows 10/11을 대상으로 하며 실제 검증은 현재 Windows amd64 환경에서 수행했습니다. Linux와 macOS는 지원하지 않습니다.

## 앱에서 연동하는 순서

현재 배포본에는 공용 OAuth 앱 ID가 포함되어 있지 않습니다. 최초 한 번은 가이드의 버튼으로 제공자 사이트에서 앱을 등록해야 하며, 이후에는 계정 선택과 권한 동의만 진행합니다. 이 최초 등록을 완료하지 않은 상태에서는 실제 계정을 연결할 수 없습니다.

1. **Google 계정 연결** 또는 **Microsoft 계정 연결**을 누릅니다. 설정이 없으면 해당 제공자의 가이드가 열립니다. **계정 연동 가이드**로 언제든 다시 볼 수 있습니다.
2. **이전 단계 / 다음 단계**로 등록 → 클라이언트 및 권한 준비 → 로그인 절차를 확인합니다. 각 단계의 **설정 페이지 열기** 버튼이 필요한 공식 페이지를 엽니다.
3. Google은 Desktop app 설정 JSON을 가져옵니다. Web app과 서비스 계정 JSON은 구체적인 이유를 표시하고 거부합니다. Microsoft는 GUID 형식의 앱 ID를 붙여 넣습니다.
4. **리디렉션 URI 복사**로 정확한 주소를 복사할 수 있습니다. Microsoft 권한과 등록 방법도 같은 창에 표시합니다.
5. **입력값 확인**은 형식만 검사합니다. **설정만 저장** 또는 **저장 후 로그인**을 선택합니다. 저장 후 로그인은 브라우저 인증으로 곧바로 이어집니다.
6. 인증 후 앱에 표시되는 계정 수와 캘린더 수로 조회 결과를 확인합니다. 실패하면 가이드로 돌아가 제공자별 해결 방법을 확인할 수 있습니다.

데모 모드에서도 계정 연결 가이드와 JSON 가져오기를 사용할 수 있습니다. **저장 후 로그인**은 앱을 재시작하지 않고 실제 계정 연결 모드로 전환합니다. 데모 계정은 실제 계정과 구분해서 표시합니다.

## 화면 사용

- 42개 날짜 버튼으로 월간 일정을 표시합니다. 날짜와 일정 수 및 첫 일정 제목을 보여주며 툴팁으로 해당 날짜의 제목들을 확인할 수 있습니다.
- 날짜를 클릭하면 아래 표에 해당 날짜의 일정만 표시합니다. **조회 범위 전체**는 월간 42일 범위의 전체 결과로 돌아갑니다.
- 캘린더 왼쪽 체크박스로 표시 여부를 바꿉니다. 목록에서 항목을 선택한 뒤 Space 키로도 전환할 수 있습니다.
- 검색은 현재 조회 범위의 제목과 장소를 필터링합니다.
- 일정 표를 선택하면 아래에 상세 내용이 나옵니다. 더블클릭이나 원본 열기 버튼은 HTTPS 원본 링크를 엽니다.
- 로그인과 조회는 백그라운드에서 수행하며 **진행 중인 작업 취소**로 취소할 수 있습니다. 동시에 다른 네트워크 작업은 시작하지 않습니다.
- 표시 선택은 현재 실행 동안 유지합니다. 재시작 시 모든 캘린더를 표시합니다.

## Google 앱 설정

1. Google Cloud 프로젝트를 생성하고 Google Calendar API를 사용 설정합니다.
2. Google Auth Platform에서 Branding, Audience, Data Access를 구성합니다. External 테스트 상태이면 로그인할 계정을 테스트 사용자에 추가합니다.
3. OAuth Client 유형을 **Desktop app**으로 생성합니다.
4. 앱의 **계정 연동 가이드 → Google 설정 JSON 가져오기**에서 다운로드 파일을 선택합니다. `installed.client_id`와 `installed.client_secret`이 자동 입력됩니다. Google 계정 비밀번호는 입력하지 않습니다.
5. Google 계정 연결 → 계정 선택 → 읽기 권한 동의 → 네이티브 창에서 결과 확인.

권한은 `https://www.googleapis.com/auth/calendar.readonly`, 리디렉션은 `http://127.0.0.1:47821/oauth/callback`입니다. 시스템 브라우저 + Authorization Code + S256 PKCE를 사용합니다. Google 데스크톱 client secret을 비밀 서버 자격 증명처럼 취급할 수 없으므로 PKCE를 함께 적용합니다. 일반 사용자에게 배포하려면 동의 화면 및 앱 검증 요건을 별도로 확인해야 합니다.

## Microsoft 앱 설정

1. Entra App registrations에 앱을 등록합니다. 개인 Outlook과 회사 계정을 모두 연결하려면 조직 디렉터리 계정과 개인 Microsoft 계정을 지원하도록 설정합니다. 코드의 authority는 `common`입니다.
2. Authentication의 **Mobile and desktop applications** 플랫폼을 사용합니다. Web/SPA 유형이 아닙니다.
3. 공용 클라이언트에 `http://127.0.0.1:47821/oauth/callback`을 등록합니다. 포털이 HTTP IP loopback 입력을 거부하면 Manifest를 편집합니다.

   Microsoft Graph 형식의 관련 부분은 다음과 같습니다. 전체 manifest를 아래 조각으로 덮어쓰지 말고 기존 설정을 보존하세요.

   ```json
   "publicClient": {
     "redirectUris": ["http://127.0.0.1:47821/oauth/callback"]
   }
   ```

   이전 Azure AD Graph 형식 편집기는 `replyUrlsWithType`의 `url`과 `type: "InstalledClient"`를 사용합니다. 실제 편집기의 스키마를 확인하세요. `localhost`만 등록하면 코드의 127.0.0.1 주소와 다릅니다.
4. Microsoft Graph의 **Delegated permissions → Calendars.Read**를 추가합니다. 앱은 `offline_access`도 요청합니다. client secret이나 Application permission을 사용하지 않습니다.
5. 계정 연동 가이드에서 Microsoft를 선택하고 Application client ID를 입력한 뒤 **저장 후 로그인**을 누릅니다.

조직 정책에 따라 관리자 동의와 앱 허용이 필요할 수 있습니다. 특정 테넌트만 사용하는 조직이라면 authority도 해당 조직 정책에 맞게 변경하세요. 앱 client ID를 바꾸면 이전 연결을 해제하고 다시 연결해야 합니다.

## 설정과 데이터

- 기본 설정 파일은 실행 파일과 같은 폴더의 `config.json`입니다. 설정 창에서 만들거나 `config.example.json`을 복사할 수 있습니다.
- 다른 설정 경로는 `calendarhub-native.exe -config C:\경로\config.json`으로 지정합니다. 쓰기 가능한 폴더에 압축을 해제하세요.
- 계정 메타데이터는 `%APPDATA%\CalendarHub\accounts.json`에 저장하며 토큰은 포함하지 않습니다.
- 토큰은 Windows 자격 증명 관리자의 `CalendarHub.Local.v1` 항목에 저장합니다. 긴 토큰은 2000바이트 조각으로 분리하며 새 세대 저장 후 manifest를 교체합니다.
- 일정은 메모리에만 유지합니다. OS 토큰 저장 과정이 비정상 종료되면 이전 세대의 고아 조각이 남을 수 있습니다.
- 기존 버전과 계정 저장 위치를 공유합니다. 동일 계정을 다시 연결하면 중복 항목이 생길 수 있습니다. 계정 표시 이름은 연결 순서에 따른 이름이며 이메일 프로필 권한은 요청하지 않습니다.
- 로컬 연결 해제는 제공자 서버의 동의를 철회하지 않습니다. 필요하면 [Google 연결 관리](https://myaccount.google.com/connections) 또는 [Microsoft 동의 관리](https://account.live.com/consent/Manage)에서도 철회하세요.

평상시에는 수신 HTTP 서버가 없습니다. 로그인할 때만 127.0.0.1:47821에서 OAuth callback을 잠시 받고 완료·취소·10분 만료 시 닫습니다. GUI 데이터는 HTTP를 거치지 않고 Go 함수로 직접 전달합니다.

## 소스 구조

```text
cmd/calendarhub/
  main_windows.go              OS 스레드 고정, 옵션, 단일 인스턴스, 앱 시작
  app.manifest                 Common Controls v6, DPI, 일반 사용자 권한
  rsrc_windows_amd64.syso       실행 파일에 넣을 Windows 리소스
internal/desktop/
  window_windows.go            Walk 창, 모델, 이벤트, 비동기 화면 갱신
  setup_windows.go             단계별 연동 가이드, 파일 선택, 검증, 로그인 연결
internal/hub/
  service.go                   계정, 설정, 직접 조회, OAuth callback
  provider.go                  Google 및 Graph API 어댑터
  models.go                    공통 모델과 데모 데이터
  view.go                      날짜 범위와 검색 및 표시 필터
  store.go                     OS 토큰과 계정 메타데이터
  setup.go                     제공자 안내와 Desktop JSON 파서 및 ID 검사
  setup_test.go                JSON 형식과 설정 검증 테스트
  provider_test.go              API 모사와 토큰 저장 테스트
  service_test.go               callback, 설정, 시간, 검색 테스트
build.ps1                      리소스 생성과 Windows GUI 빌드
```

## 개발과 빌드

Go 1.23 이상, Windows amd64가 필요합니다. 제공된 실행 파일은 Go 1.27.3으로 빌드했습니다. 기본 Walk 메시지 루프를 사용하므로 CGO, GCC, Node, WebView 런타임은 필요하지 않습니다. Common Controls v6 manifest는 `.syso`로 실행 파일에 내장합니다.

```powershell
go mod download
# 제공된 .syso를 사용해 빌드
go build -trimpath -ldflags '-H windowsgui' -o calendarhub-native.exe ./cmd/calendarhub
# manifest 변경 시 리소스 재생성
go run github.com/akavel/rsrc@v0.10.2 -manifest cmd/calendarhub/app.manifest -arch amd64 -o cmd/calendarhub/rsrc_windows_amd64.syso
# 전체 빌드는 build.ps1의 내용과 동일
# 테스트와 정적 검사
go test ./...
go vet ./...
# OS 자격 증명 테스트는 임시 임의 항목을 저장하고 삭제
$env:CALENDARHUB_TEST_VAULT = '1'
go test ./internal/hub -run TestSystemVaultLargeToken -v
```

`go run ./cmd/calendarhub -demo`로 개발할 수도 있습니다. 실제 설정 파일은 임시 실행 파일 폴더가 아닌 프로젝트 경로에 두도록 `go run ./cmd/calendarhub -config ./config.json`을 사용하세요.

## 현재 범위와 제한

- Google과 Microsoft 다중 계정, 캘린더별 필터, 월 이동, 날짜 선택, 검색, 상세, 반복 일정과 종일 일정 조회를 구현했습니다.
- 일정 생성·수정, iCloud/CalDAV/ICS, delta 동기화, 주기적 자동 새로고침, 오프라인 캐시, 중복 일정 통합은 포함하지 않습니다.
- 전체 조회는 75초, 개별 API 요청은 20초입니다. 부분 실패 시 성공 결과와 경고를 표시합니다. 429 자동 재시도는 아직 없습니다.
- Microsoft 공유 일정은 로그인 계정의 `/me/calendars` 및 위임 권한으로 노출되는 범위에 한합니다.
- 시간 일정은 PC 현지 시간대로 표시합니다. 종일 일정 종료일은 포함하지 않습니다. Graph 종일 일정은 원래 시간대로 다시 조회해 날짜 이동을 방지합니다.
- 실계정 OAuth 동의와 실제 제공자 호출은 사용자 client ID 및 로그인이 필요해 여기서 검증하지 못했습니다. 실행 파일과 데모, 네이티브 UI 조작, 모사 API 및 Windows 자격 증명 저장은 검증했습니다.

## 공식 자료

- [Walk 소스와 manifest 및 빌드 안내](https://github.com/lxn/walk)
- [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Go quickstart](https://developers.google.com/workspace/calendar/api/quickstart/go)
- [Microsoft Redirect URI](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
- [Microsoft calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)
