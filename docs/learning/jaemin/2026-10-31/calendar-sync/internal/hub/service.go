package hub

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"sync"
	"time"
	_ "time/tzdata"

	"golang.org/x/oauth2"
)

// This loopback endpoint receives OAuth redirects only. There is no web GUI.
const origin = "http://127.0.0.1:47821"

type Settings struct{ GoogleID, GoogleSecret, MicrosoftID string }
type Service struct {
	mu               sync.Mutex
	authMu           sync.Mutex
	config           settings
	configPath, path string
	accounts         []Account
	vault            Vault
	demo             bool
}

func random() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func New(configPath string, demo bool) (*Service, error) {
	s := &Service{configPath: configPath, vault: systemVault{}, demo: demo, accounts: []Account{}}
	b, e := os.ReadFile(configPath)
	if e == nil {
		if e = json.Unmarshal(b, &s.config); e != nil {
			return nil, fmt.Errorf("설정 JSON 오류: %w", e)
		}
	} else if !os.IsNotExist(e) {
		return nil, e
	}
	dir, e := os.UserConfigDir()
	if e != nil {
		return nil, e
	}
	s.path = filepath.Join(dir, "CalendarHub", "accounts.json")
	if !demo {
		s.accounts, e = loadAccounts(s.path)
	}
	return s, e
}
func (s *Service) IsDemo() bool { return s.demo }
func (s *Service) EnableRealMode() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.demo {
		return nil
	}
	accounts, e := loadAccounts(s.path)
	if e != nil {
		return e
	}
	s.accounts = accounts
	s.demo = false
	return nil
}
func (s *Service) Settings() Settings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return Settings{s.config.Google.ClientID, s.config.Google.ClientSecret, s.config.Microsoft.ClientID}
}
func (s *Service) SaveSettings(v Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	updated := settings{clientSettings{v.GoogleID, v.GoogleSecret}, clientSettings{ClientID: v.MicrosoftID}}
	b, e := json.MarshalIndent(updated, "", "  ")
	if e != nil {
		return e
	}
	if e = os.MkdirAll(filepath.Dir(s.configPath), 0700); e != nil {
		return e
	}
	f, e := os.CreateTemp(filepath.Dir(s.configPath), "config-*.tmp")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(b); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	if e = os.Rename(name, s.configPath); e != nil {
		return e
	}
	s.config = updated
	return nil
}
func (s *Service) Disconnect(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.demo {
		return errors.New("데모 계정은 삭제할 수 없습니다")
	}
	for i, a := range s.accounts {
		if a.ID == id {
			if e := s.vault.Delete(id); e != nil {
				return errors.New("OS 자격 증명을 삭제하지 못했습니다")
			}
			updated := append(append([]Account{}, s.accounts[:i]...), s.accounts[i+1:]...)
			if e := saveAccounts(s.path, updated); e != nil {
				return e
			}
			s.accounts = updated
			return nil
		}
	}
	return errors.New("계정을 찾을 수 없습니다")
}
func (s *Service) Snapshot(ctx context.Context, start, end time.Time) (Snapshot, error) {
	if !end.After(start) || end.Sub(start) > 63*24*time.Hour {
		return Snapshot{}, errors.New("조회 범위는 63일 이내여야 합니다")
	}
	if s.demo {
		return demoSnapshot(start.AddDate(0, 0, 7)), nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Snapshot{Accounts: append([]Account{}, s.accounts...), Calendars: []Calendar{}, Events: []Event{}, Errors: []string{}}
	ctx, cancel := context.WithTimeout(ctx, 75*time.Second)
	defer cancel()
	for _, a := range s.accounts {
		if ctx.Err() != nil {
			out.Errors = append(out.Errors, "조회 제한 시간 초과 또는 취소")
			break
		}
		token, e := s.vault.Get(a.ID)
		if e != nil {
			out.Errors = append(out.Errors, a.Label+": 로그인 정보를 읽을 수 없습니다. 다시 연결하세요.")
			continue
		}
		cfg := s.config.oauth(a.Provider)
		if cfg == nil || cfg.ClientID == "" {
			out.Errors = append(out.Errors, a.Label+": OAuth 앱 설정을 확인하세요.")
			continue
		}
		client := oauth2.NewClient(ctx, &durableSource{cfg.TokenSource(ctx, token), s.vault, a.ID, token})
		client.Timeout = 20 * time.Second
		p := remote{client, "https://www.googleapis.com/calendar/v3", "https://graph.microsoft.com/v1.0"}
		cs, e := p.calendars(ctx, a)
		if e != nil {
			out.Errors = append(out.Errors, a.Label+": 캘린더 조회 실패. 네트워크와 권한을 확인하세요.")
			continue
		}
		out.Calendars = append(out.Calendars, cs...)
		for _, c := range cs {
			es, e := p.events(ctx, a, c, start, end)
			if e != nil {
				out.Errors = append(out.Errors, c.Name+": 일정 조회 실패")
				continue
			}
			out.Events = append(out.Events, es...)
		}
	}
	sort.Slice(out.Events, func(i, j int) bool { return out.Events[i].Start < out.Events[j].Start })
	return out, nil
}
func OpenURL(raw string) error {
	u, e := url.Parse(raw)
	if e != nil || u.Scheme != "https" || u.Host == "" {
		return errors.New("HTTPS 링크만 열 수 있습니다")
	}
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", u.String())
	if e = cmd.Start(); e != nil {
		return e
	}
	go cmd.Wait()
	return nil
}

type authReply struct {
	code string
	err  error
}

func receiveCode(state string, replies chan<- authReply) http.Handler {
	var mu sync.Mutex
	used := false
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Host != "127.0.0.1:47821" || r.URL.Path != "/oauth/callback" || r.Method != "GET" {
			http.Error(w, "OAuth callback only", 404)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if used || subtle.ConstantTimeCompare([]byte(state), []byte(r.URL.Query().Get("state"))) != 1 {
			http.Error(w, "Invalid or expired login state", 400)
			return
		}
		used = true
		if r.URL.Query().Get("error") != "" {
			replies <- authReply{err: errors.New("로그인이 취소되었거나 권한이 거부되었습니다")}
			fmt.Fprint(w, "로그인이 취소되었습니다. Calendar Hub 창으로 돌아가세요.")
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			replies <- authReply{err: errors.New("인증 코드가 없습니다")}
			http.Error(w, "Missing code", 400)
			return
		}
		replies <- authReply{code: code}
		fmt.Fprint(w, "인증 응답을 받았습니다. 이 탭을 닫고 Calendar Hub 네이티브 창으로 돌아가세요. 최종 연결 결과는 앱에서 확인할 수 있습니다.")
	})
}
func (s *Service) Connect(ctx context.Context, provider string) error {
	if s.demo {
		return errors.New("데모 모드에서는 로그인할 수 없습니다")
	}
	if !s.authMu.TryLock() {
		return errors.New("다른 로그인이 진행 중입니다")
	}
	defer s.authMu.Unlock()
	s.mu.Lock()
	cfg := s.config.oauth(provider)
	s.mu.Unlock()
	if cfg == nil || cfg.ClientID == "" {
		return errors.New("OAuth 앱 설정에서 client ID를 입력하세요")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	listener, e := net.Listen("tcp", "127.0.0.1:47821")
	if e != nil {
		return errors.New("로그인 수신 포트 47821이 사용 중입니다. 기존 Calendar Hub를 종료하세요")
	}
	state, verifier := random(), oauth2.GenerateVerifier()
	replies := make(chan authReply, 1)
	server := &http.Server{Handler: receiveCode(state, replies), ReadHeaderTimeout: 5 * time.Second}
	defer server.Close()
	go server.Serve(listener)
	opts := []oauth2.AuthCodeOption{oauth2.S256ChallengeOption(verifier), oauth2.SetAuthURLParam("prompt", "select_account")}
	if provider == "google" {
		opts = append(opts, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent select_account"))
	}
	if e = OpenURL(cfg.AuthCodeURL(state, opts...)); e != nil {
		return e
	}
	var reply authReply
	select {
	case <-ctx.Done():
		return errors.New("로그인이 취소되었거나 10분이 지났습니다")
	case reply = <-replies:
	}
	if reply.err != nil {
		return reply.err
	}
	exchangeCtx, stop := context.WithTimeout(ctx, 30*time.Second)
	defer stop()
	token, e := cfg.Exchange(exchangeCtx, reply.code, oauth2.VerifierOption(verifier))
	if e != nil {
		return errors.New("인증 코드 교환 실패. 앱 설정과 리디렉션 URI를 확인하세요")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	id := random()
	a := Account{id, provider, fmt.Sprintf("%s 계정 %d", provider, len(s.accounts)+1)}
	if e = s.vault.Set(id, token); e != nil {
		return errors.New("OS 자격 증명 관리자에 토큰을 저장하지 못했습니다")
	}
	updated := append(append([]Account{}, s.accounts...), a)
	if e = saveAccounts(s.path, updated); e != nil {
		_ = s.vault.Delete(id)
		return e
	}
	s.accounts = updated
	return nil
}
