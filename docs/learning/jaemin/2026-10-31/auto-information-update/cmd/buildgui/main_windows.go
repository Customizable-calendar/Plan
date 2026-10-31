package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
)

type builder struct {
	mw                  *walk.MainWindow
	form                *walk.Composite
	goPath, source      *walk.LineEdit
	logs                *walk.TextEdit
	status              *walk.Label
	build, stop, launch *walk.PushButton
	bar                 *walk.ProgressBar
	cancel              context.CancelFunc
	closing             bool
	output              string
}

func main() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	base := filepath.Dir(exe)
	b := &builder{output: filepath.Join(base, "PaperDigest.exe")}
	goPath, _ := exec.LookPath("go.exe")
	if goPath == "" {
		candidate := filepath.Join(os.Getenv("ProgramFiles"), "Go", "bin", "go.exe")
		if _, err := os.Stat(candidate); err == nil {
			goPath = candidate
		}
	}
	err = MainWindow{
		AssignTo: &b.mw, Title: "Paper Digest · GUI 빌드 도구", Size: Size{Width: 870, Height: 650}, MinSize: Size{Width: 760, Height: 560},
		Font: Font{Family: "맑은 고딕", PointSize: 10}, Layout: VBox{Margins: Margins{Left: 24, Top: 20, Right: 24, Bottom: 20}, Spacing: 12},
		Children: []Widget{
			Label{Text: "실행 파일 만들기", Font: Font{Family: "맑은 고딕", PointSize: 22, Bold: true}, TextColor: walk.RGB(24, 79, 96)},
			Label{Text: "Go 1.26 이상이 필요합니다. 검증과 빌드를 버튼 한 번으로 실행합니다."},
			Composite{AssignTo: &b.form, Layout: Grid{Columns: 3, Spacing: 10}, Children: []Widget{
				Label{Text: "Go 실행 파일"}, LineEdit{AssignTo: &b.goPath, Text: goPath, MinSize: Size{Width: 480}}, PushButton{Text: "찾아보기", OnClicked: b.browseGo},
				Label{Text: "소스 폴더"}, LineEdit{AssignTo: &b.source, Text: filepath.Join(base, "source")}, PushButton{Text: "폴더 선택", OnClicked: b.browseSource},
			}},
			Label{Text: "출력: " + b.output},
			Label{Text: "최초 빌드에는 Go 모듈 다운로드를 위한 인터넷 연결이 필요합니다. 실행 중인 PaperDigest 창은 먼저 닫으세요."},
			Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
				PushButton{AssignTo: &b.build, Text: "검증하고 빌드", OnClicked: b.start},
				PushButton{AssignTo: &b.stop, Text: "취소", Enabled: false, OnClicked: b.cancelWork},
				HSpacer{}, PushButton{AssignTo: &b.launch, Text: "완성된 앱 실행", Enabled: false, OnClicked: b.openApp},
			}},
			Label{AssignTo: &b.status, Text: "준비됨 · Go 경로와 소스 폴더를 확인하세요."},
			ProgressBar{AssignTo: &b.bar, MaxSize: Size{Height: 8}},
			TextEdit{AssignTo: &b.logs, ReadOnly: true, VScroll: true, MinSize: Size{Height: 220}, StretchFactor: 1},
		},
	}.Create()
	if err != nil {
		walk.MsgBox(nil, "빌드 도구 오류", err.Error(), walk.MsgBoxIconError)
		return
	}
	b.mw.Closing().Attach(func(canceled *bool, reason walk.CloseReason) {
		if b.cancel != nil {
			*canceled = true
			b.closing = true
			b.cancelWork()
		}
	})
	b.mw.Run()
}

func (b *builder) error(err error) {
	walk.MsgBox(b.mw, "확인 필요", err.Error(), walk.MsgBoxIconWarning)
}
func (b *builder) browseGo() {
	dlg := walk.FileDialog{Title: "go.exe 선택", Filter: "Go 실행 파일 (go.exe)|go.exe", FilePath: b.goPath.Text()}
	if ok, err := dlg.ShowOpen(b.mw); err != nil {
		b.error(err)
	} else if ok {
		b.goPath.SetText(dlg.FilePath)
	}
}
func (b *builder) browseSource() {
	dlg := walk.FileDialog{Title: "go.mod가 있는 source 폴더 선택", FilePath: b.source.Text()}
	if ok, err := dlg.ShowBrowseFolder(b.mw); err != nil {
		b.error(err)
	} else if ok {
		b.source.SetText(dlg.FilePath)
	}
}
func (b *builder) append(text string) {
	if len(b.logs.Text()) > 100000 {
		b.logs.SetText("")
	}
	b.logs.AppendText(strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\n", "\r\n"))
}

type logWriter struct{ b *builder }

func (w logWriter) Write(p []byte) (int, error) {
	text := string(p)
	w.b.mw.Synchronize(func() { w.b.append(text) })
	return len(p), nil
}

func (b *builder) cancelWork() {
	if b.cancel != nil {
		b.cancel()
		b.stop.SetEnabled(false)
		b.status.SetText("취소 요청 중…")
	}
}
func (b *builder) openApp() {
	c := exec.Command(b.output)
	c.Dir = filepath.Dir(b.output)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := c.Start(); err != nil {
		b.error(err)
		return
	}
	go c.Wait()
}
func (b *builder) start() {
	goPath := strings.TrimSpace(b.goPath.Text())
	source := strings.TrimSpace(b.source.Text())
	if goPath == "" {
		b.error(fmt.Errorf("Go를 설치한 후 go.exe 경로를 선택하세요"))
		return
	}
	if _, err := os.Stat(goPath); err != nil {
		b.error(err)
		return
	}
	if _, err := os.Stat(filepath.Join(source, "go.mod")); err != nil {
		b.error(fmt.Errorf("go.mod가 있는 source 폴더를 선택하세요"))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	b.cancel = cancel
	b.form.SetEnabled(false)
	b.build.SetEnabled(false)
	b.stop.SetEnabled(true)
	b.launch.SetEnabled(false)
	b.bar.SetMarqueeMode(true)
	b.logs.SetText("")
	b.status.SetText("테스트 · 정적 검사 · GUI 실행 파일 빌드 중…")
	go func() {
		err := b.compile(ctx, goPath, source)
		cancel()
		b.mw.Synchronize(func() {
			b.cancel = nil
			b.form.SetEnabled(true)
			b.build.SetEnabled(true)
			b.stop.SetEnabled(false)
			b.bar.SetMarqueeMode(false)
			if err != nil {
				b.status.SetText("빌드 실패 또는 취소 · 로그를 확인하세요.")
				b.append("\n" + err.Error() + "\n")
			} else {
				b.status.SetText("빌드 완료 · PaperDigest.exe를 실행할 수 있습니다.")
				b.launch.SetEnabled(true)
				b.append("\n완료: " + b.output + "\n")
			}
			if b.closing {
				b.mw.Close()
			}
		})
	}()
}
func (b *builder) compile(ctx context.Context, goPath, source string) error {
	f, err := os.CreateTemp(filepath.Dir(b.output), ".PaperDigest-build-*.exe")
	if err != nil {
		return err
	}
	temp := f.Name()
	f.Close()
	defer os.Remove(temp)
	steps := [][]string{{"version"}, {"test", "-count=1", "./..."}, {"vet", "./..."}, {"build", "-trimpath", "-ldflags=-H windowsgui -s -w", "-o", temp, "."}}
	for _, args := range steps {
		logWriter{b}.Write([]byte("\n> go " + strings.Join(args, " ") + "\n"))
		c := exec.CommandContext(ctx, goPath, args...)
		c.Dir = source
		c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		c.Stdout = logWriter{b}
		c.Stderr = logWriter{b}
		// Prevent inherited opt-in network tests or cross-compilation settings.
		c.Env = append(os.Environ(), "PAPER_DIGEST_LIVE_TEST=0", "GOOS=windows", "GOARCH=amd64", "CGO_ENABLED=0")
		if err := c.Run(); err != nil {
			return fmt.Errorf("%s 실패: %w", args[0], err)
		}
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.Rename(temp, b.output); err != nil {
		return fmt.Errorf("완성 파일 교체 실패. 실행 중인 PaperDigest 앱을 닫고 다시 빌드하세요: %w", err)
	}
	return nil
}
