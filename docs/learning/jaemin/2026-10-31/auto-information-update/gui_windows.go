//go:build windows && !cli

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
	"github.com/lxn/win"
)

type digestWindow struct {
	mw                         *walk.MainWindow
	form                       *walk.Composite
	key, output                *walk.LineEdit
	topic, logs                *walk.TextEdit
	model, sources             *walk.ComboBox
	days, count, candidates    *walk.NumberEdit
	status                     *walk.Label
	once, repeat, stop, latest *walk.PushButton
	bar                        *walk.ProgressBar
	cancel                     context.CancelFunc
	closing                    bool
	base, settings, lastReport string
}

func main() {
	exe, err := os.Executable()
	if err != nil {
		walk.MsgBox(nil, "시작 오류", err.Error(), walk.MsgBoxIconError)
		return
	}
	base := filepath.Dir(exe)
	u := &digestWindow{base: base, settings: filepath.Join(base, "settings.json")}
	p, loadErr := readPreferences(u.settings, base)
	err = MainWindow{
		AssignTo: &u.mw, Title: "Paper Digest · Gemini 논문 리서치", MinSize: Size{Width: 860, Height: 740}, Size: Size{Width: 1020, Height: 800},
		Font: Font{Family: "맑은 고딕", PointSize: 10}, Layout: VBox{Margins: Margins{Left: 24, Top: 18, Right: 24, Bottom: 18}, Spacing: 10},
		Children: []Widget{
			Label{Text: "Paper Digest", Font: Font{Family: "맑은 고딕", PointSize: 22, Bold: true}, TextColor: walk.RGB(24, 79, 96)},
			Label{Text: "관심 문장에서 논문을 찾고, 초록과 한국어 요약을 Markdown으로 저장합니다."},
			Composite{AssignTo: &u.form, Layout: VBox{MarginsZero: true, Spacing: 10}, Children: []Widget{
				GroupBox{Title: "1  Gemini 연결", Layout: Grid{Columns: 3, Spacing: 8}, Children: []Widget{
					Label{Text: "API 키"}, LineEdit{AssignTo: &u.key, PasswordMode: true, Text: os.Getenv("GEMINI_API_KEY"), CueBanner: "Google AI Studio API 키", MinSize: Size{Width: 400}},
					PushButton{Text: "모델 조회", OnClicked: u.loadModels},
					Label{Text: "사용 모델"}, ComboBox{AssignTo: &u.model, Model: []string{"자동 선택"}, CurrentIndex: 0},
					Label{Text: "키는 저장하지 않습니다."},
				}},
				GroupBox{Title: "2  관심 주제", Layout: VBox{Spacing: 6}, Children: []Widget{
					TextEdit{AssignTo: &u.topic, Text: p.Topic, VScroll: true, MinSize: Size{Height: 90}, MaxLength: 10000},
					Label{Text: "영어 검색어를 자동 추출합니다. 원문 초록이 있는 논문만 보고서에 포함됩니다."},
				}},
				GroupBox{Title: "3  검색 및 저장", Layout: Grid{Columns: 6, Spacing: 8}, Children: []Widget{
					Label{Text: "출처"}, ComboBox{AssignTo: &u.sources, Model: []string{"arXiv + Europe PMC", "arXiv", "Europe PMC"}, CurrentIndex: sourceIndex(p.Sources), ColumnSpan: 2},
					Label{Text: "검색 기간"}, NumberEdit{AssignTo: &u.days, Value: float64(p.Days), MinValue: 0, MaxValue: 36500, Suffix: " 일", ColumnSpan: 2},
					Label{Text: "논문 수"}, NumberEdit{AssignTo: &u.count, Value: float64(p.MaxPapers), MinValue: 1, MaxValue: 20, ColumnSpan: 2},
					Label{Text: "출처별 후보"}, NumberEdit{AssignTo: &u.candidates, Value: float64(p.Candidates), MinValue: 1, MaxValue: 100, ColumnSpan: 2},
					Label{Text: "저장 폴더"}, LineEdit{AssignTo: &u.output, Text: p.Output, ColumnSpan: 4}, PushButton{Text: "폴더 선택", OnClicked: u.browseOutput},
					Label{Text: "기간 0 = 전체 기간 · 초록 원문 전체 + 논문별 요약 + 종합 비교 · 기본 주기 6시간", ColumnSpan: 6},
				}},
			}},
			Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
				PushButton{AssignTo: &u.once, Text: "한 번 실행", OnClicked: func() { u.start(false) }},
				PushButton{AssignTo: &u.repeat, Text: "6시간마다 실행", OnClicked: func() { u.start(true) }},
				PushButton{AssignTo: &u.stop, Text: "중지", Enabled: false, OnClicked: u.stopWork},
				HSpacer{}, PushButton{Text: "설정 저장", OnClicked: u.save},
				PushButton{Text: "보고서 폴더", OnClicked: func() { u.openFolder() }},
				PushButton{AssignTo: &u.latest, Text: "최근 보고서", Enabled: false, OnClicked: func() { u.open(u.lastReport) }},
			}},
			Label{AssignTo: &u.status, Text: "준비됨 · API 키와 관심 문장을 입력하세요.", Font: Font{Family: "맑은 고딕", PointSize: 10, Bold: true}},
			ProgressBar{AssignTo: &u.bar, MaxSize: Size{Height: 8}},
			TextEdit{AssignTo: &u.logs, ReadOnly: true, VScroll: true, MinSize: Size{Height: 100}, StretchFactor: 1},
			Label{Text: "창과 PC가 켜져 있어야 자동 실행됩니다. AI 요약은 초록을 근거로 하며 원문 확인이 필요합니다."},
		},
	}.Create()
	if err != nil {
		walk.MsgBox(nil, "화면 생성 오류", err.Error(), walk.MsgBoxIconError)
		return
	}
	if p.Model != "" {
		u.model.SetModel([]string{"자동 선택", p.Model})
		u.model.SetCurrentIndex(1)
	}
	log.SetOutput(guiLogger{u})
	log.SetFlags(log.Ltime)
	u.mw.Closing().Attach(func(canceled *bool, reason walk.CloseReason) {
		if u.cancel != nil {
			*canceled = true
			u.closing = true
			u.stopWork()
			u.status.SetText("작업을 정리한 뒤 종료합니다…")
		}
	})
	if loadErr != nil {
		u.appendLog("저장 설정을 읽을 수 없어 기본값을 사용합니다: " + loadErr.Error())
	}
	u.appendLog("API 키는 현재 실행 중 메모리에만 보관합니다. 설정 저장에는 API 키가 포함되지 않습니다.")
	u.mw.Run()
}

func sourceIndex(s string) int {
	if s == "arxiv" {
		return 1
	}
	if s == "europepmc" {
		return 2
	}
	return 0
}
func (u *digestWindow) preferences() Preferences {
	sources := []string{"arxiv,europepmc", "arxiv", "europepmc"}
	i := u.sources.CurrentIndex()
	if i < 0 || i >= len(sources) {
		i = 0
	}
	model := u.model.Text()
	if model == "자동 선택" {
		model = ""
	}
	return Preferences{Topic: strings.TrimSpace(u.topic.Text()), Model: model, Output: strings.TrimSpace(u.output.Text()), Sources: sources[i], Days: int(u.days.Value()), MaxPapers: int(u.count.Value()), Candidates: int(u.candidates.Value())}
}
func (u *digestWindow) error(err error) {
	walk.MsgBox(u.mw, "확인 필요", err.Error(), walk.MsgBoxIconWarning)
}
func (u *digestWindow) save() {
	p := u.preferences()
	if err := savePreferences(u.settings, p); err != nil {
		u.error(err)
		return
	}
	u.appendLog("관심 주제와 검색 설정을 저장했습니다. API 키는 저장하지 않았습니다.")
}
func (u *digestWindow) browseOutput() {
	dlg := walk.FileDialog{Title: "보고서를 저장할 폴더 선택", FilePath: u.output.Text()}
	if ok, err := dlg.ShowBrowseFolder(u.mw); err != nil {
		u.error(err)
	} else if ok {
		u.output.SetText(dlg.FilePath)
	}
}
func (u *digestWindow) openFolder() {
	path := strings.TrimSpace(u.output.Text())
	if path == "" {
		u.error(fmt.Errorf("저장 폴더를 선택하세요"))
		return
	}
	if err := os.MkdirAll(path, 0700); err != nil {
		u.error(err)
		return
	}
	u.open(path)
}
func (u *digestWindow) open(path string) {
	if path == "" {
		return
	}
	verb, _ := syscall.UTF16PtrFromString("open")
	file, _ := syscall.UTF16PtrFromString(path)
	result, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW").Call(uintptr(u.mw.Handle()), uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)), 0, 0, uintptr(win.SW_SHOWNORMAL))
	if result <= 32 {
		u.error(fmt.Errorf("파일 또는 폴더를 열 수 없습니다. 연결 프로그램을 확인하세요 (코드 %d)", result))
	}
}
func (u *digestWindow) appendLog(text string) {
	if len(u.logs.Text()) > 60000 {
		u.logs.SetText("")
	}
	u.logs.AppendText(strings.ReplaceAll(strings.TrimSpace(text), "\n", "\r\n") + "\r\n")
}

type guiLogger struct{ u *digestWindow }

func (w guiLogger) Write(p []byte) (int, error) {
	text := string(p)
	w.u.mw.Synchronize(func() { w.u.appendLog(text) })
	return len(p), nil
}
func (u *digestWindow) busy(cancel context.CancelFunc) {
	u.cancel = cancel
	u.form.SetEnabled(false)
	u.once.SetEnabled(false)
	u.repeat.SetEnabled(false)
	u.stop.SetEnabled(true)
	u.bar.SetMarqueeMode(true)
}
func (u *digestWindow) done(status string) {
	u.cancel = nil
	u.form.SetEnabled(true)
	u.once.SetEnabled(true)
	u.repeat.SetEnabled(true)
	u.stop.SetEnabled(false)
	u.bar.SetMarqueeMode(false)
	u.status.SetText(status)
	if u.closing {
		u.mw.Close()
	}
}
func (u *digestWindow) stopWork() {
	if u.cancel != nil {
		u.cancel()
		u.stop.SetEnabled(false)
		u.status.SetText("중지 요청 중…")
	}
}
func newAPI(key string) *API {
	return &API{Client: &http.Client{Timeout: 120 * time.Second}, Key: key, GeminiURL: "https://generativelanguage.googleapis.com/v1beta", ArxivURL: "https://export.arxiv.org/api/query", PMCURL: "https://www.ebi.ac.uk/europepmc/webservices/rest/search", RetryDelay: 3 * time.Second}
}
func (u *digestWindow) loadModels() {
	key := strings.TrimSpace(u.key.Text())
	if key == "" {
		u.error(fmt.Errorf("AI Studio API 키를 입력하세요"))
		return
	}
	previous := u.model.Text()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	u.busy(cancel)
	u.status.SetText("사용 가능한 Gemini 모델을 조회하고 있습니다…")
	go func() {
		defer cancel()
		models, err := newAPI(key).models(ctx)
		u.mw.Synchronize(func() {
			if err != nil {
				u.appendLog("모델 조회: " + err.Error())
				u.done("모델 조회가 종료되었습니다. 로그를 확인하세요.")
				return
			}
			names := []string{"자동 선택"}
			selected := 0
			for _, m := range models {
				names = append(names, m.Name)
				if m.Name == previous {
					selected = len(names) - 1
				}
			}
			u.model.SetModel(names)
			u.model.SetCurrentIndex(selected)
			u.appendLog(fmt.Sprintf("Gemini 모델 %d개를 조회했습니다. 실제 생성 가능 여부는 모델 기능·권한·할당량에 따라 달라집니다.", len(models)))
			u.done("모델 조회 완료 · 자동 선택 또는 원하는 텍스트 모델을 선택하세요.")
		})
	}()
}
func (u *digestWindow) start(repeat bool) {
	key := strings.TrimSpace(u.key.Text())
	if key == "" {
		u.error(fmt.Errorf("AI Studio API 키를 입력하세요"))
		return
	}
	p := u.preferences()
	if err := p.validate(); err != nil {
		u.error(err)
		return
	}
	out, err := filepath.Abs(p.Output)
	if err != nil {
		u.error(err)
		return
	}
	p.Output = out
	u.output.SetText(out)
	release, err := acquireRunLock(out)
	if err != nil {
		u.error(err)
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	u.busy(cancel)
	u.status.SetText("논문 검색과 요약을 시작합니다…")
	a := &App{Config: Config{Topic: p.Topic, Model: p.Model, Out: p.Output, Sources: p.Sources, Days: p.Days, Max: p.MaxPapers, Candidates: p.Candidates, Interval: 6 * time.Hour}, API: newAPI(key)}
	go func() {
		status := "완료 · 보고서가 저장되었습니다."
		defer func() { release(); cancel(); u.mw.Synchronize(func() { u.done(status) }) }()
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			u.mw.Synchronize(func() {
				u.bar.SetMarqueeMode(true)
				u.status.SetText("진행 중 · 모델 확인 → 키워드 추출 → 논문 검색 → 요약 저장")
			})
			runCtx, runCancel := context.WithTimeout(ctx, 15*time.Minute)
			path, err := a.cycle(runCtx)
			runCancel()
			if ctx.Err() != nil {
				status = "중지됨 · 실행을 다시 시작할 수 있습니다."
				return
			}
			if err != nil {
				log.Printf("실행 실패: %v", err)
				status = "실행 실패 · 로그를 확인하세요."
			} else {
				log.Printf("보고서 저장: %s", path)
				u.mw.Synchronize(func() { u.lastReport = path; u.latest.SetEnabled(true) })
			}
			if !repeat {
				return
			}
			u.mw.Synchronize(func() {
				u.bar.SetMarqueeMode(false)
				u.status.SetText("자동 실행 대기 중 · 시작 시각 기준 6시간 간격 · 변경하려면 중지 후 다시 시작")
			})
			select {
			case <-ctx.Done():
				status = "자동 실행이 중지되었습니다."
				return
			case <-ticker.C:
			}
		}
	}()
}
