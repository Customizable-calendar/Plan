package hub

import (
	"sort"
	"strings"
	"time"
)

func MonthRange(month time.Time) (time.Time, time.Time) {
	s := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, month.Location())
	s = s.AddDate(0, 0, -int(s.Weekday()))
	return s, s.AddDate(0, 0, 42)
}
func OnDay(e Event, day time.Time) bool {
	key := day.Format(time.DateOnly)
	if e.AllDay {
		return e.Start <= key && key < e.End
	}
	start, err := time.Parse(time.RFC3339Nano, e.Start)
	if err != nil {
		return false
	}
	end, err := time.Parse(time.RFC3339Nano, e.End)
	if err != nil {
		return false
	}
	s := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	t := s.AddDate(0, 0, 1)
	return start.Before(t) && (end.After(s) || (end.Equal(start) && !start.Before(s)))
}
func FilterEvents(events []Event, hidden map[string]bool, query string, day *time.Time) []Event {
	q := strings.ToLower(strings.TrimSpace(query))
	out := []Event{}
	for _, e := range events {
		if hidden[e.CalendarID] || !strings.Contains(strings.ToLower(e.Title+" "+e.Location), q) {
			continue
		}
		if day != nil && !OnDay(e, *day) {
			continue
		}
		out = append(out, e)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Start < out[j].Start })
	return out
}
func EventTime(e Event) string {
	if e.AllDay {
		end, err := time.Parse(time.DateOnly, e.End)
		if err != nil {
			return e.Start + " · 종일"
		}
		return e.Start + " ~ " + end.AddDate(0, 0, -1).Format(time.DateOnly) + " · 종일"
	}
	s, e1 := time.Parse(time.RFC3339Nano, e.Start)
	t, e2 := time.Parse(time.RFC3339Nano, e.End)
	if e1 != nil || e2 != nil {
		return e.Start
	}
	return s.Local().Format("01-02 15:04") + " ~ " + t.Local().Format("01-02 15:04")
}
