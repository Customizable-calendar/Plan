package hub

import "time"

type Account struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Label    string `json:"label"`
}
type Calendar struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Name      string `json:"name"`
	Color     string `json:"color"`
}

// All-day start/end are floating YYYY-MM-DD dates; End is exclusive.
type Event struct {
	ID         string `json:"id"`
	CalendarID string `json:"calendarId"`
	Title      string `json:"title"`
	Start      string `json:"start"`
	End        string `json:"end"`
	AllDay     bool   `json:"allDay"`
	Location   string `json:"location"`
	URL        string `json:"url"`
}
type Snapshot struct {
	Accounts  []Account  `json:"accounts"`
	Calendars []Calendar `json:"calendars"`
	Events    []Event    `json:"events"`
	Errors    []string   `json:"errors"`
}

func demoSnapshot(start time.Time) Snapshot {
	d := time.Date(start.Year(), start.Month(), 12, 9, 0, 0, 0, start.Location())
	s := Snapshot{Accounts: []Account{{"demo-google", "google", "개인 · 데모"}, {"demo-ms", "microsoft", "회사 · 데모"}}, Calendars: []Calendar{{"personal", "demo-google", "개인 일정", "#6d5ce7"}, {"work", "demo-ms", "팀 일정", "#16897b"}, {"family", "demo-google", "가족", "#db8242"}}, Events: []Event{}, Errors: []string{}}
	for i, x := range []struct {
		title, cal, place   string
		day, hour, duration int
	}{{"제품 기획 회의", "work", "회의실 A", 0, 10, 1}, {"Go 스터디", "personal", "온라인", 0, 19, 2}, {"가족과 저녁", "family", "레스토랑", 2, 18, 2}, {"디자인 리뷰", "work", "온라인", 4, 14, 1}, {"집중 작업", "work", "", 6, 9, 3}, {"주말 산책", "personal", "공원", 8, 10, 1}} {
		t := time.Date(d.Year(), d.Month(), 12+x.day, x.hour, 0, 0, 0, d.Location())
		s.Events = append(s.Events, Event{ID: string(rune('a' + i)), CalendarID: x.cal, Title: x.title, Start: t.Format(time.RFC3339), End: t.Add(time.Duration(x.duration) * time.Hour).Format(time.RFC3339), Location: x.place})
	}
	s.Events = append(s.Events, Event{ID: "trip", CalendarID: "family", Title: "가족 여행", Start: d.AddDate(0, 0, 9).Format(time.DateOnly), End: d.AddDate(0, 0, 12).Format(time.DateOnly), AllDay: true})
	return s
}
