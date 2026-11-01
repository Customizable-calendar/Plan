//go:build windows

package desktop

import (
	"fmt"
	"io"
	"os"
	"strings"

	"calendarhub/internal/hub"
	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
)

// A native wizard keeps registration guidance, import, validation and login
// together. Saving a valid format does not imply a successful OAuth connection.
func (w *Window) setupDialog(provider string) {
	if w.loading {
		return
	}
	if provider != "microsoft" {
		provider = "google"
	}
	current := w.service.Settings()
	step := 0
	connectAfter := false
	var dialog *walk.Dialog
	var choice *walk.ComboBox
	var title *walk.Label
	var help, note, check *walk.TextEdit
	var google, secret, microsoft *walk.LineEdit
	var googlePanel, microsoftPanel *walk.Composite
	var back, next, action, saveLogin, closeButton *walk.PushButton
	var render func()
	settings := func() hub.Settings {
		return hub.Settings{GoogleID: strings.TrimSpace(google.Text()), GoogleSecret: strings.TrimSpace(secret.Text()), MicrosoftID: strings.TrimSpace(microsoft.Text())}
	}
	save := func(login bool) {
		v := settings()
		if e := hub.ValidateProviderSettings(provider, v); e != nil {
			check.SetText("설정 확인: " + e.Error())
			step = 1
			render()
			return
		}
		if e := w.service.SaveSettings(v); e != nil {
			check.SetText("저장 실패: " + e.Error())
			return
		}
		if login && w.service.IsDemo() {
			if e := w.service.EnableRealMode(); e != nil {
				check.SetText(e.Error())
				return
			}
			w.modeLabel.SetText("Google Calendar + Microsoft Outlook · 읽기 전용")
			w.snapshot = hub.Snapshot{}
			w.calendars.items = nil
			w.calendars.PublishRowsReset()
			w.accounts.SetModel([]string{})
			w.busy(false, "실제 계정 연결 모드")
			w.render()
		}
		w.updateConnectionStatus()
		if login {
			connectAfter = true
			dialog.Accept()
		} else {
			check.SetText("저장 완료. 실제 계정 연결은 저장 후 로그인으로 진행하세요.")
		}
	}
	render = func() {
		steps := hub.SetupSteps(provider)
		title.SetText(steps[step].Title)
		help.SetText(steps[step].Text)
		action.SetText(steps[step].Action)
		googlePanel.SetVisible(provider == "google")
		microsoftPanel.SetVisible(provider == "microsoft")
		back.SetEnabled(step > 0)
		next.SetEnabled(step < len(steps)-1)
		if w.service.IsDemo() {
			note.SetText("데모에서도 저장 후 로그인을 누르면 바로 실제 계정 연결 모드로 전환됩니다.")
		} else {
			note.SetText("설정 파일: " + w.service.ConfigPath())
		}
	}
	importJSON := func() {
		picker := walk.FileDialog{Title: "Google에서 다운로드한 Desktop 클라이언트 JSON 선택", Filter: "Google OAuth JSON (*.json)|*.json|모든 파일 (*.*)|*.*"}
		accepted, e := picker.ShowOpen(dialog)
		if e != nil {
			check.SetText("파일 선택 실패: " + e.Error())
			return
		}
		if !accepted {
			return
		}
		file, e := os.Open(picker.FilePath)
		if e != nil {
			check.SetText("파일을 읽을 수 없습니다.")
			return
		}
		defer file.Close()
		b, e := io.ReadAll(io.LimitReader(file, (1<<20)+1))
		if e != nil {
			check.SetText("파일을 읽을 수 없습니다.")
			return
		}
		imported, e := hub.ParseGoogleDesktopJSON(b)
		if e != nil {
			check.SetText(e.Error())
			return
		}
		google.SetText(imported.GoogleID)
		secret.SetText(imported.GoogleSecret)
		step = 2
		render()
		check.SetText("Google Desktop JSON을 가져왔습니다. 저장 후 로그인을 눌러 계정을 연결하세요.")
	}
	selected := 0
	if provider == "microsoft" {
		selected = 1
	}
	err := (Dialog{AssignTo: &dialog, Title: "캘린더 연결 가이드", Font: Font{Family: "맑은 고딕", PointSize: 9}, Size: Size{Width: 850, Height: 790}, MinSize: Size{Width: 800, Height: 750}, Layout: VBox{Margins: Margins{Left: 18, Top: 15, Right: 18, Bottom: 15}, Spacing: 8}, CancelButton: &closeButton, DefaultButton: &next, Children: []Widget{
		Label{Text: "캘린더 연결을 시작하세요", Font: Font{Family: "맑은 고딕", PointSize: 17, Bold: true}},
		Label{Text: "연결할 서비스"}, ComboBox{AssignTo: &choice, Model: []string{"Google Calendar", "Microsoft Outlook / Microsoft 365"}, CurrentIndex: selected, OnCurrentIndexChanged: func() {
			if help == nil {
				return
			}
			provider = "google"
			if choice.CurrentIndex() == 1 {
				provider = "microsoft"
			}
			step = 0
			check.SetText("")
			render()
		}},
		Label{AssignTo: &title, Font: Font{PointSize: 12, Bold: true}},
		TextEdit{AssignTo: &help, ReadOnly: true, VScroll: true, MinSize: Size{Height: 210}, StretchFactor: 1},
		PushButton{AssignTo: &action, Text: "설정 페이지 열기", OnClicked: func() {
			if e := hub.OpenURL(hub.SetupSteps(provider)[step].URL); e != nil {
				check.SetText(e.Error())
			}
		}},
		Composite{AssignTo: &googlePanel, Layout: VBox{MarginsZero: true, Spacing: 5}, Children: []Widget{
			PushButton{Text: "Google 설정 JSON 가져오기", OnClicked: importJSON},
			Label{Text: "Google Desktop client ID"}, LineEdit{AssignTo: &google, Text: current.GoogleID},
			Label{Text: "Google Desktop client_secret  ·  JSON 가져오기로 자동 입력"}, LineEdit{AssignTo: &secret, Text: current.GoogleSecret, PasswordMode: true},
		}},
		Composite{AssignTo: &microsoftPanel, Layout: VBox{MarginsZero: true, Spacing: 5}, Children: []Widget{Label{Text: "Application (client) ID  ·  Entra Overview에서 복사"}, LineEdit{AssignTo: &microsoft, Text: current.MicrosoftID, CueBanner: "예: 12345678-1234-1234-1234-123456789abc"}, Label{Text: "client secret은 필요하지 않습니다. 2단계에서 리디렉션과 Calendars.Read를 설정하세요."}}},
		Composite{Layout: HBox{MarginsZero: true}, Children: []Widget{LineEdit{Text: hub.RedirectURI, ReadOnly: true, StretchFactor: 1}, PushButton{Text: "리디렉션 URI 복사", OnClicked: func() {
			if e := walk.Clipboard().SetText(hub.RedirectURI); e != nil {
				check.SetText(e.Error())
			} else {
				check.SetText("리디렉션 URI를 복사했습니다.")
			}
		}}}},
		Composite{Layout: HBox{MarginsZero: true}, Children: []Widget{PushButton{Text: "입력값 확인", OnClicked: func() {
			e := hub.ValidateProviderSettings(provider, settings())
			if e != nil {
				check.SetText(e.Error())
			} else {
				check.SetText("입력 형식 확인 완료. 등록 및 권한은 로그인 후 실제 조회로 확인합니다.")
			}
		}}, PushButton{Text: "설정만 저장", OnClicked: func() { save(false) }}, HSpacer{}}},
		TextEdit{AssignTo: &check, ReadOnly: true, Text: "등록한 앱이 있다면 JSON 가져오기 또는 앱 ID 입력 후 바로 로그인할 수 있습니다.", MinSize: Size{Height: 42}, MaxSize: Size{Height: 48}},
		TextEdit{AssignTo: &note, ReadOnly: true, MinSize: Size{Height: 32}, MaxSize: Size{Height: 40}},
		Composite{Layout: HBox{MarginsZero: true}, Children: []Widget{PushButton{AssignTo: &back, Text: "이전 단계", OnClicked: func() {
			if step > 0 {
				step--
				render()
			}
		}}, PushButton{AssignTo: &next, Text: "다음 단계", OnClicked: func() {
			if step < 2 {
				step++
				render()
			}
		}}, HSpacer{}, PushButton{AssignTo: &saveLogin, Text: "저장 후 로그인", OnClicked: func() { save(true) }}, PushButton{AssignTo: &closeButton, Text: "나중에", OnClicked: func() { dialog.Cancel() }}}},
	}}).Create(w.main)
	if err != nil {
		w.message(err.Error())
		return
	}
	defer dialog.Dispose()
	render()
	dialog.Run()
	if connectAfter && w.ctx.Err() == nil {
		w.connect(provider)
	}
}
func (w *Window) updateConnectionStatus() {
	if w.connectionStatus == nil {
		return
	}
	s := w.service.Settings()
	lines := []string{}
	for _, p := range []string{"google", "microsoft"} {
		name := "Google"
		if p == "microsoft" {
			name = "Microsoft"
		}
		accounts, calendars := 0, 0
		ids := map[string]bool{}
		for _, a := range w.snapshot.Accounts {
			if a.Provider == p {
				accounts++
				ids[a.ID] = true
			}
		}
		for _, c := range w.snapshot.Calendars {
			if ids[c.AccountID] {
				calendars++
			}
		}
		status := "최초 설정 필요 → 연결 가이드"
		if hub.ValidateProviderSettings(p, s) == nil {
			status = "설정됨 · 로그인 가능"
		}
		if accounts > 0 {
			status = fmt.Sprintf("계정 %d개 · 캘린더 %d개", accounts, calendars)
		}
		if w.service.IsDemo() {
			status = "데모 샘플 · 실제 연결은 위 버튼"
		}
		lines = append(lines, name+": "+status)
	}
	w.connectionStatus.SetText(strings.Join(lines, "\r\n"))
}
