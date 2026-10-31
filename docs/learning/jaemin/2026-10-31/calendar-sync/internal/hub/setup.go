package hub

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

const RedirectURI = origin + "/oauth/callback"

type SetupStep struct{ Title, Text, Action, URL string }

func SetupSteps(provider string) []SetupStep {
	if provider == "google" {
		return []SetupStep{
			{"1  Google 프로젝트 준비", "처음 한 번만 이 앱의 로그인 설정을 준비합니다. 이후에는 Google 계정을 선택하고 동의하면 됩니다.\r\n\r\n① 아래 버튼으로 Google Cloud를 열고 프로젝트를 선택하거나 만드세요.\r\n② Google Calendar API를 사용 설정하세요.\r\n③ Google Auth Platform → Branding에서 앱 이름과 연락처를 설정하세요.\r\n④ 개인 계정이면 Audience를 External로 설정하고, Testing 상태에서는 로그인할 계정을 Test users에 추가하세요.\r\n\r\n현재 제공된 실행 파일에는 배포자 공용 OAuth 앱 ID가 포함되어 있지 않아 최초 앱 등록이 필요합니다. 등록된 Google Desktop 설정 JSON이 있다면 가져오기로 바로 진행할 수 있습니다.", "Google Calendar API 설정 열기", "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"},
			{"2  데스크톱 설정 가져오기", "① 아래 버튼으로 Google Auth Platform → Clients를 여세요.\r\n② Create client → Application type을 Desktop app으로 선택하세요.\r\n③ 생성한 클라이언트에서 JSON 파일을 다운로드하세요.\r\n④ 이 창의 Google 설정 JSON 가져오기를 눌러 그 파일을 선택하세요. ID와 client_secret을 자동으로 채웁니다.\r\n\r\nWeb application이나 서비스 계정 JSON은 사용할 수 없습니다. 계정 비밀번호를 입력하지 않습니다. Google에서 다운로드한 파일의 installed 항목을 읽으며 API 서버 주소는 파일에서 가져오지 않습니다.", "Google OAuth 클라이언트 열기", "https://console.cloud.google.com/auth/clients"},
			{"3  저장하고 Google 계정 연결", "① 아래의 저장 후 로그인 버튼을 누르세요.\r\n② 기본 브라우저에서 연결할 Google 계정을 선택하세요.\r\n③ 캘린더 읽기 권한을 허용하세요.\r\n④ 인증 응답을 받은 뒤 Calendar Hub 네이티브 창으로 돌아오세요.\r\n⑤ 왼쪽에 계정과 캘린더가 나타나면 완료입니다.\r\n\r\naccess_denied: Audience의 Test users와 Calendar API 사용 설정을 확인하세요.\r\nredirect_uri_mismatch: 클라이언트가 Desktop app인지 확인하세요.\r\n다른 계정은 메인 창의 Google 계정 연결 버튼으로 추가합니다.", "Google 공식 설정 안내 열기", "https://developers.google.com/workspace/calendar/api/quickstart/go"},
		}
	}
	return []SetupStep{
		{"1  Microsoft 앱 등록", "처음 한 번만 이 앱의 로그인 설정을 준비합니다. 이후에는 계정 선택과 권한 동의만 진행합니다.\r\n\r\n① 아래 버튼으로 Microsoft Entra App registrations를 열고 New registration을 선택하세요.\r\n② 개인 Outlook과 회사 계정을 함께 연결하려면 조직 디렉터리 계정 및 개인 Microsoft 계정을 지원하도록 선택하세요.\r\n③ 등록 후 Overview의 Application (client) ID를 복사해 아래 Microsoft 앱 ID에 붙여 넣으세요.\r\n\r\n현재 배포본에는 공용 앱 ID가 포함되어 있지 않습니다. 회사 계정에서 앱 등록 권한이 없으면 조직 관리자에게 등록 또는 허용을 요청해야 합니다.", "Microsoft 앱 등록 열기", "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"},
		{"2  리디렉션과 읽기 권한 설정", "① 앱의 Authentication에서 Mobile and desktop applications 플랫폼을 사용하세요. Web 또는 SPA가 아닙니다.\r\n② 아래 리디렉션 URI를 복사해 public client에 등록하세요.\r\n③ HTTP 127.0.0.1 입력을 거부하면 Manifest의 publicClient.redirectUris 배열에 해당 URI를 추가하세요. 기존 설정을 보존해야 합니다.\r\n④ API permissions → Microsoft Graph → Delegated permissions → Calendars.Read를 추가하세요.\r\n\r\nclient secret은 만들거나 입력하지 않습니다. 앱은 offline_access도 요청합니다. 조직 정책에 따라 관리자 동의가 필요합니다.", "Microsoft 리디렉션 공식 안내 열기", "https://learn.microsoft.com/en-us/entra/identity-platform/reply-url"},
		{"3  저장하고 Microsoft 계정 연결", "① 아래 저장 후 로그인 버튼을 누르세요.\r\n② 기본 브라우저에서 Outlook 또는 회사 계정을 선택하세요.\r\n③ 요청된 캘린더 읽기 권한에 동의하고 앱으로 돌아오세요.\r\n④ 계정과 캘린더 목록을 확인하세요. 다른 계정도 같은 로그인 버튼으로 추가할 수 있습니다.\r\n\r\nAADSTS50011: 리디렉션 URI가 127.0.0.1 주소와 일치하는지 확인하세요. localhost만 등록하면 다릅니다.\r\n관리자 승인 필요: 회사 관리자에게 위임 권한 및 앱 허용을 요청하세요.\r\n개인 계정 거부: Supported account types에 개인 Microsoft 계정 지원이 포함되는지 확인하세요.", "Microsoft 앱 등록 공식 안내 열기", "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"},
	}
}

var microsoftID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func ValidateProviderSettings(provider string, s Settings) error {
	switch provider {
	case "google":
		if !strings.HasSuffix(strings.TrimSpace(s.GoogleID), ".apps.googleusercontent.com") || strings.ContainsAny(s.GoogleID, " \r\n\t") {
			return errors.New("Google Desktop app의 client ID가 필요합니다. 다운로드한 JSON을 가져오세요")
		}
		if strings.TrimSpace(s.GoogleSecret) == "" {
			return errors.New("Google Desktop JSON의 client_secret이 없습니다. JSON을 다시 가져오세요")
		}
	case "microsoft":
		if !microsoftID.MatchString(strings.TrimSpace(s.MicrosoftID)) {
			return errors.New("Microsoft Overview의 Application (client) ID를 입력하세요. 8-4-4-4-12자리의 GUID 형식입니다")
		}
	default:
		return errors.New("지원하지 않는 제공자입니다")
	}
	return nil
}
func ParseGoogleDesktopJSON(b []byte) (Settings, error) {
	if len(b) > 1<<20 {
		return Settings{}, errors.New("파일이 너무 큽니다. Google Desktop 클라이언트 JSON을 선택하세요")
	}
	var doc struct {
		Installed *struct {
			ID     string `json:"client_id"`
			Secret string `json:"client_secret"`
		} `json:"installed"`
		Web json.RawMessage `json:"web"`
	}
	if e := json.Unmarshal(b, &doc); e != nil {
		return Settings{}, errors.New("올바른 JSON 파일이 아닙니다")
	}
	if doc.Installed == nil {
		return Settings{}, errors.New("Desktop app JSON이 아닙니다. Google Clients에서 Desktop app을 생성해 다운로드하세요")
	}
	out := Settings{GoogleID: strings.TrimSpace(doc.Installed.ID), GoogleSecret: strings.TrimSpace(doc.Installed.Secret)}
	if e := ValidateProviderSettings("google", out); e != nil {
		return Settings{}, e
	}
	return out, nil
}
func (s *Service) ConfigPath() string { return s.configPath }
