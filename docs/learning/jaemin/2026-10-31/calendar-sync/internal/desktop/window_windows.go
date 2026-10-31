//go:build windows

package desktop

import (
	"context"
	"fmt"
	"strings"
	"time"

	"calendarhub/internal/hub"
	"github.com/lxn/walk"
	. "github.com/lxn/walk/declarative"
	"github.com/lxn/win"
)

type calendarModel struct {
	walk.TableModelBase
	items   []hub.Calendar
	hidden  map[string]bool
	changed func()
}

func (m *calendarModel) RowCount() int                  { return len(m.items) }
func (m *calendarModel) Value(row, col int) interface{} { return m.items[row].Name }
func (m *calendarModel) Checked(row int) bool           { return !m.hidden[m.items[row].ID] }
func (m *calendarModel) SetChecked(row int, checked bool) error {
	m.hidden[m.items[row].ID] = !checked
	if m.changed != nil {
		m.changed()
	}
	return nil
}

type eventModel struct {
	walk.TableModelBase
	items []hub.Event
	names map[string]string
}

func (m *eventModel) RowCount() int { return len(m.items) }
func (m *eventModel) Value(row, col int) interface{} {
	e := m.items[row]
	switch col {
	case 0:
		return hub.EventTime(e)
	case 1:
		return e.Title
	case 2:
		return m.names[e.CalendarID]
	case 3:
		return e.Location
	}
	return ""
}

type Window struct {
	main                               *walk.MainWindow
	service                            *hub.Service
	ctx                                context.Context
	cancel                             context.CancelFunc
	operationCancel                    context.CancelFunc
	month                              time.Time
	day                                *time.Time
	snapshot                           hub.Snapshot
	calendars                          *calendarModel
	events                             *eventModel
	calendarTable, eventTable          *walk.TableView
	accounts                           *walk.ComboBox
	search                             *walk.LineEdit
	monthLabel, selectionLabel, status *walk.Label
	details, warnings                  *walk.TextEdit
	connectionStatus                   *walk.TextEdit
	modeLabel                          *walk.Label
	welcomed                           bool
	days                               [42]*walk.PushButton
	controls                           []*walk.PushButton
	prev, next, today                  *walk.PushButton
	loginCancel                        *walk.PushButton
	loading                            bool
}

func Run(service *hub.Service) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	now := time.Now()
	w := &Window{service: service, ctx: ctx, cancel: cancel, month: time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)}
	w.calendars = &calendarModel{hidden: map[string]bool{}}
	w.events = &eventModel{names: map[string]string{}}
	w.calendars.changed = w.render
	var google, microsoft, settings, disconnect, refresh *walk.PushButton
	weekday := []string{"일", "월", "화", "수", "목", "금", "토"}
	rows := []Widget{}
	headers := []Widget{}
	for _, name := range weekday {
		headers = append(headers, Label{Text: name, TextAlignment: AlignCenter, StretchFactor: 1})
	}
	rows = append(rows, Composite{Layout: HBox{MarginsZero: true}, Children: headers})
	for r := 0; r < 6; r++ {
		cells := []Widget{}
		for c := 0; c < 7; c++ {
			i := r*7 + c
			cells = append(cells, PushButton{AssignTo: &w.days[i], Text: " ", MinSize: Size{Width: 80, Height: 48}, MaxSize: Size{Width: 0, Height: 48}, StretchFactor: 1, OnClicked: func() { start, _ := hub.MonthRange(w.month); day := start.AddDate(0, 0, i); w.day = &day; w.render() }})
		}
		rows = append(rows, Composite{Layout: HBox{MarginsZero: true, Spacing: 4}, Children: cells})
	}
	mode := "Google Calendar + Microsoft Outlook · 읽기 전용"
	if service.IsDemo() {
		mode = "데모 모드 · 계정 연결 버튼으로 실제 로그인 시작"
	}
	err := (MainWindow{AssignTo: &w.main, Title: "Calendar Hub Native", Size: Size{Width: 1250, Height: 920}, MinSize: Size{Width: 1120, Height: 850}, Font: Font{Family: "맑은 고딕", PointSize: 9}, Layout: VBox{Margins: Margins{Left: 18, Top: 14, Right: 18, Bottom: 12}, Spacing: 10}, Children: []Widget{
		Label{Text: "Calendar Hub", Font: Font{Family: "맑은 고딕", PointSize: 20, Bold: true}}, Label{AssignTo: &w.modeLabel, Text: mode},
		Composite{Layout: HBox{MarginsZero: true, Spacing: 18}, StretchFactor: 1, Children: []Widget{
			Composite{MinSize: Size{Width: 245, Height: 0}, MaxSize: Size{Width: 245, Height: 0}, Layout: VBox{MarginsZero: true, Spacing: 9}, Children: []Widget{
				Label{Text: "계정 연결", Font: Font{Bold: true}},
				PushButton{AssignTo: &google, Text: "Google 계정 연결", OnClicked: func() { w.connect("google") }},
				PushButton{AssignTo: &microsoft, Text: "Microsoft 계정 연결", OnClicked: func() { w.connect("microsoft") }},
				PushButton{AssignTo: &w.loginCancel, Text: "진행 중인 작업 취소", Enabled: false, OnClicked: func() {
					if w.operationCancel != nil {
						w.operationCancel()
					}
				}},
				PushButton{AssignTo: &settings, Text: "계정 연동 가이드", OnClicked: func() { w.setupDialog("google") }},
				TextEdit{AssignTo: &w.connectionStatus, ReadOnly: true, MinSize: Size{Height: 65}, MaxSize: Size{Height: 65}},
				Label{Text: "연결된 계정"}, ComboBox{AssignTo: &w.accounts},
				PushButton{AssignTo: &disconnect, Text: "선택 계정 연결 해제", Enabled: !service.IsDemo(), OnClicked: w.disconnect},
				Label{Text: "표시할 캘린더", Font: Font{Bold: true}},
				TableView{AssignTo: &w.calendarTable, Model: w.calendars, CheckBoxes: true, LastColumnStretched: true, Columns: []TableViewColumn{{Title: "캘린더", Width: 210}}, MinSize: Size{Width: 0, Height: 150}, StretchFactor: 1},
				Label{Text: "조회 결과 및 경고"}, TextEdit{AssignTo: &w.warnings, ReadOnly: true, VScroll: true, MinSize: Size{Width: 0, Height: 90}, MaxSize: Size{Width: 0, Height: 110}},
			}},
			Composite{StretchFactor: 1, Layout: VBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
				Composite{Layout: HBox{MarginsZero: true}, Children: []Widget{
					PushButton{AssignTo: &w.prev, Text: "이전 달", OnClicked: func() { w.move(-1) }}, Label{AssignTo: &w.monthLabel, Font: Font{PointSize: 15, Bold: true}, StretchFactor: 1, TextAlignment: AlignCenter}, PushButton{AssignTo: &w.next, Text: "다음 달", OnClicked: func() { w.move(1) }}, PushButton{AssignTo: &w.today, Text: "오늘", OnClicked: func() {
						n := time.Now()
						w.month = time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.Local)
						w.day = &n
						w.load()
					}}, PushButton{AssignTo: &refresh, Text: "새로고침", OnClicked: w.load},
				}},
				Composite{Layout: VBox{MarginsZero: true, Spacing: 4}, Children: rows},
				Composite{Layout: HBox{MarginsZero: true}, Children: []Widget{Label{AssignTo: &w.selectionLabel, StretchFactor: 1}, PushButton{Text: "조회 범위 전체", OnClicked: func() { w.day = nil; w.render() }}, Label{Text: "검색"}, LineEdit{AssignTo: &w.search, MinSize: Size{Width: 230, Height: 0}, CueBanner: "제목 또는 장소", OnTextChanged: w.render}}},
				TableView{AssignTo: &w.eventTable, Model: w.events, AlternatingRowBG: true, LastColumnStretched: true, ColumnsSizable: true, Columns: []TableViewColumn{{Title: "시간", Width: 225}, {Title: "일정", Width: 220}, {Title: "캘린더", Width: 140}, {Title: "장소", Width: 130}}, MinSize: Size{Width: 0, Height: 150}, StretchFactor: 1, OnCurrentIndexChanged: w.showDetails, OnItemActivated: w.openEvent},
				TextEdit{AssignTo: &w.details, ReadOnly: true, VScroll: true, MinSize: Size{Width: 0, Height: 65}, MaxSize: Size{Width: 0, Height: 75}},
				PushButton{Text: "선택 일정 원본 열기", OnClicked: w.openEvent},
			}},
		}}, Label{AssignTo: &w.status, Text: "준비 중"},
	}}).Create()
	if err != nil {
		return err
	}
	defer w.main.Dispose()
	for _, b := range w.days {
		win.SetWindowLong(b.Handle(), win.GWL_STYLE, win.GetWindowLong(b.Handle(), win.GWL_STYLE)|win.BS_MULTILINE)
	}
	w.controls = []*walk.PushButton{google, microsoft, settings, disconnect, refresh, w.prev, w.next, w.today}
	w.main.Closing().Attach(func(canceled *bool, reason walk.CloseReason) {
		cancel()
		if w.operationCancel != nil {
			w.operationCancel()
		}
	})
	w.load()
	w.main.Run()
	return nil
}
func (w *Window) busy(value bool, message string) {
	w.loading = value
	for _, b := range w.controls {
		b.SetEnabled(!value)
	}
	if w.service.IsDemo() {
		w.controls[3].SetEnabled(false)
	}
	w.loginCancel.SetEnabled(value)
	w.status.SetText(message)
}
func (w *Window) load() {
	if w.loading {
		return
	}
	ctx, cancel := context.WithCancel(w.ctx)
	w.operationCancel = cancel
	start, end := hub.MonthRange(w.month)
	w.busy(true, "일정을 불러오는 중입니다…")
	go func() {
		s, e := w.service.Snapshot(ctx, start, end)
		cancel()
		if w.ctx.Err() != nil {
			return
		}
		w.main.Synchronize(func() {
			if w.ctx.Err() != nil {
				return
			}
			w.busy(false, "조회 완료 · "+time.Now().Format("15:04:05"))
			if e != nil {
				w.status.SetText(e.Error())
				return
			}
			w.snapshot = s
			w.calendars.items = s.Calendars
			w.calendars.PublishRowsReset()
			labels := []string{}
			for _, a := range s.Accounts {
				labels = append(labels, a.Label)
			}
			w.accounts.SetModel(labels)
			if len(labels) > 0 {
				w.accounts.SetCurrentIndex(0)
			}
			w.warnings.SetText(strings.Join(s.Errors, "\r\n"))
			if len(s.Errors) == 0 {
				w.warnings.SetText(fmt.Sprintf("%d개 계정 · %d개 캘린더\r\n현재 PC 시간대 기준", len(s.Accounts), len(s.Calendars)))
			}
			w.render()
			w.updateConnectionStatus()
			if !w.welcomed && !w.service.IsDemo() && len(s.Accounts) == 0 {
				w.welcomed = true
				w.setupDialog("google")
			}
		})
	}()
}
func (w *Window) move(n int) {
	if w.loading {
		return
	}
	w.month = w.month.AddDate(0, n, 0)
	w.day = nil
	w.load()
}
func (w *Window) render() {
	if w.search == nil || w.monthLabel == nil {
		return
	}
	w.monthLabel.SetText(w.month.Format("2006년 1월"))
	query := w.search.Text()
	visible := hub.FilterEvents(w.snapshot.Events, w.calendars.hidden, query, nil)
	start, _ := hub.MonthRange(w.month)
	for i, b := range w.days {
		day := start.AddDate(0, 0, i)
		count := 0
		first := ""
		titles := []string{}
		for _, e := range visible {
			if hub.OnDay(e, day) {
				count++
				titles = append(titles, e.Title)
				if first == "" {
					r := []rune(e.Title)
					if len(r) > 10 {
						r = r[:10]
					}
					first = string(r)
				}
			}
		}
		prefix := ""
		if day.Month() != w.month.Month() {
			prefix = fmt.Sprintf("%d/", day.Month())
		}
		date := prefix + fmt.Sprint(day.Day())
		if day.Format(time.DateOnly) == time.Now().Format(time.DateOnly) {
			date = "오늘 " + date
		}
		if w.day != nil && day.Format(time.DateOnly) == w.day.Format(time.DateOnly) {
			date = "[" + date + "]"
		}
		text := date
		if count > 0 {
			text += fmt.Sprintf(" · %d개\n%s", count, first)
		}
		b.SetText(text)
		b.SetToolTipText(strings.Join(titles, "\r\n"))
	}
	w.events.names = map[string]string{}
	for _, c := range w.snapshot.Calendars {
		w.events.names[c.ID] = c.Name
	}
	w.events.items = hub.FilterEvents(w.snapshot.Events, w.calendars.hidden, query, w.day)
	w.events.PublishRowsReset()
	w.eventTable.SetCurrentIndex(-1)
	w.details.SetText("일정을 선택하면 세부 정보가 표시됩니다. 원본은 더블클릭으로 열 수 있습니다.")
	label := "조회 범위 전체"
	if w.day != nil {
		label = w.day.Format("2006-01-02")
	}
	w.selectionLabel.SetText(fmt.Sprintf("%s · %d개 일정", label, len(w.events.items)))
}
func (w *Window) showDetails() {
	i := w.eventTable.CurrentIndex()
	if i < 0 || i >= len(w.events.items) {
		return
	}
	e := w.events.items[i]
	w.details.SetText(e.Title + "\r\n" + hub.EventTime(e) + "\r\n캘린더: " + w.events.names[e.CalendarID] + "  장소: " + e.Location)
}
func (w *Window) openEvent() {
	i := w.eventTable.CurrentIndex()
	if i < 0 || i >= len(w.events.items) {
		return
	}
	u := w.events.items[i].URL
	if u == "" {
		walk.MsgBox(w.main, "원본 링크", "데모 일정이거나 원본 링크가 없습니다.", walk.MsgBoxIconInformation)
		return
	}
	if e := hub.OpenURL(u); e != nil {
		w.message(e.Error())
	}
}
func (w *Window) message(text string) {
	walk.MsgBox(w.main, "Calendar Hub", text, walk.MsgBoxIconInformation)
}
func (w *Window) connect(provider string) {
	if w.loading {
		return
	}
	if w.service.IsDemo() || hub.ValidateProviderSettings(provider, w.service.Settings()) != nil {
		w.setupDialog(provider)
		return
	}
	ctx, cancel := context.WithCancel(w.ctx)
	w.operationCancel = cancel
	w.busy(true, "시스템 브라우저에서 로그인하세요. 완료되면 이 창에 계정이 추가됩니다.")
	go func() {
		e := w.service.Connect(ctx, provider)
		cancel()
		if w.ctx.Err() != nil {
			return
		}
		w.main.Synchronize(func() {
			w.busy(false, "로그인 작업 종료")
			if e != nil {
				if walk.MsgBox(w.main, "연결을 완료하지 못했습니다", e.Error()+"\r\n\r\n연동 가이드를 열어 설정과 해결 방법을 확인할까요?", walk.MsgBoxYesNo|walk.MsgBoxIconInformation) == walk.DlgCmdYes {
					w.setupDialog(provider)
				}
				return
			}
			w.load()
		})
	}()
}
func (w *Window) disconnect() {
	if w.loading {
		return
	}
	i := w.accounts.CurrentIndex()
	if i < 0 || i >= len(w.snapshot.Accounts) {
		w.message("먼저 연결된 계정을 선택하세요.")
		return
	}
	if walk.MsgBox(w.main, "연결 해제", "이 PC의 계정 토큰을 삭제할까요? 제공자 서버의 동의 철회는 별도로 진행해야 합니다.", walk.MsgBoxYesNo|walk.MsgBoxIconQuestion) != walk.DlgCmdYes {
		return
	}
	if e := w.service.Disconnect(w.snapshot.Accounts[i].ID); e != nil {
		w.message(e.Error())
		return
	}
	w.load()
}
