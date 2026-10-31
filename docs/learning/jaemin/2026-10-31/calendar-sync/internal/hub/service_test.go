package hub

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestCallbackStateReplayAndHost(t *testing.T) {
	replies := make(chan authReply, 1)
	handler := receiveCode("expected", replies)
	for _, tc := range []struct {
		host, path string
		status     int
	}{{"evil.test", "/oauth/callback?state=expected&code=code", 404}, {"127.0.0.1:47821", "/", 404}, {"127.0.0.1:47821", "/oauth/callback?state=wrong&code=code", 400}, {"127.0.0.1:47821", "/oauth/callback?state=expected&code=code", 200}, {"127.0.0.1:47821", "/oauth/callback?state=expected&code=replay", 400}} {
		r := httptest.NewRequest("GET", tc.path, nil)
		r.Host = tc.host
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%s %s %d", tc.host, tc.path, w.Code)
		}
	}
	reply := <-replies
	if reply.code != "code" || reply.err != nil {
		t.Fatal("invalid accepted response")
	}
	if len(replies) != 0 {
		t.Fatal("replayed response queued")
	}
}
func TestCallbackCancellation(t *testing.T) {
	replies := make(chan authReply, 1)
	r := httptest.NewRequest("GET", "/oauth/callback?state=ok&error=access_denied", nil)
	r.Host = "127.0.0.1:47821"
	receiveCode("ok", replies).ServeHTTP(httptest.NewRecorder(), r)
	if (<-replies).err == nil {
		t.Fatal("cancellation ignored")
	}
}
func TestSettingsAndDemo(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	s, e := New(path, true)
	if e != nil {
		t.Fatal(e)
	}
	want := Settings{"google-id", "desktop-secret", "ms-id"}
	if e = s.SaveSettings(want); e != nil {
		t.Fatal(e)
	}
	s, e = New(path, true)
	if e != nil || s.Settings() != want {
		t.Fatalf("settings %v", e)
	}
	month := time.Date(2026, 10, 1, 0, 0, 0, 0, time.Local)
	start, end := MonthRange(month)
	snapshot, e := s.Snapshot(context.Background(), start, end)
	if e != nil || len(snapshot.Events) != 7 || len(snapshot.Calendars) != 3 {
		t.Fatalf("demo %v", e)
	}
	if _, e = s.Snapshot(context.Background(), start, start.AddDate(0, 0, 70)); e == nil {
		t.Fatal("invalid range accepted")
	}
}

func TestEnableRealMode(t *testing.T) {
	s, e := New(filepath.Join(t.TempDir(), "config.json"), true)
	if e != nil {
		t.Fatal(e)
	}
	s.path = filepath.Join(t.TempDir(), "accounts.json")
	if e = saveAccounts(s.path, []Account{{ID: "existing", Provider: "google", Label: "Existing"}}); e != nil {
		t.Fatal(e)
	}
	if e = s.EnableRealMode(); e != nil {
		t.Fatal(e)
	}
	if s.IsDemo() || len(s.accounts) != 1 || s.accounts[0].ID != "existing" {
		t.Fatal("demo did not switch to real account state")
	}
}
func TestAllDayAndTimeBoundaries(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Seoul")
	day := time.Date(2026, 10, 21, 0, 0, 0, 0, loc)
	all := Event{CalendarID: "family", Title: "가족 여행", Start: "2026-10-21", End: "2026-10-24", AllDay: true}
	for i := 0; i < 4; i++ {
		if OnDay(all, day.AddDate(0, 0, i)) != (i < 3) {
			t.Fatalf("all-day boundary %d", i)
		}
	}
	timed := Event{Start: "2026-10-20T23:00:00+09:00", End: "2026-10-21T00:00:00+09:00"}
	if OnDay(timed, day) {
		t.Fatal("exclusive midnight boundary")
	}
	hidden := map[string]bool{"family": true}
	if len(FilterEvents([]Event{all}, hidden, "", nil)) != 0 {
		t.Fatal("hidden calendar shown")
	}
	if len(FilterEvents([]Event{all}, nil, "여행", &day)) != 1 {
		t.Fatal("search/day mismatch")
	}
}
