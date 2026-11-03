package hub

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"

	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"
)

func TestGooglePaginationAndRecurrenceQuery(t *testing.T) {
	count := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count++
		if strings.HasSuffix(r.URL.Path, "calendarList") {
			if r.URL.Query().Get("pageToken") == "two" {
				fmt.Fprint(w, `{"items":[{"id":"b","summary":"B"}]}`)
			} else {
				fmt.Fprint(w, `{"items":[{"id":"a","summary":"A"}],"nextPageToken":"two"}`)
			}
			return
		}
		if r.URL.Query().Get("singleEvents") != "true" || r.URL.Query().Get("timeMin") == "" {
			t.Error("missing recurrence or range parameters")
		}
		if r.URL.Query().Get("pageToken") == "two" {
			fmt.Fprint(w, `{"items":[{"id":"cancel","status":"cancelled"}]}`)
		} else {
			fmt.Fprint(w, `{"items":[{"id":"all","summary":"휴가","start":{"date":"2026-10-01"},"end":{"date":"2026-10-03"}}],"nextPageToken":"two"}`)
		}
	}))
	defer server.Close()
	p := remote{server.Client(), server.URL, server.URL}
	a := Account{"u", "google", "test"}
	cs, e := p.calendars(context.Background(), a)
	if e != nil || len(cs) != 2 {
		t.Fatalf("calendars: %v %v", cs, e)
	}
	start, _ := time.Parse(time.DateOnly, "2026-10-01")
	events, e := p.events(context.Background(), a, cs[0], start, start.AddDate(0, 1, 0))
	if e != nil || len(events) != 1 || !events[0].AllDay || events[0].End != "2026-10-03" || count != 4 {
		t.Fatalf("events: %v %v calls %d", events, e, count)
	}
}
func TestGraphOriginalAllDayAndPagination(t *testing.T) {
	var base string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/events/day"):
			if r.Header.Get("Prefer") != `outlook.timezone="Korea Standard Time"` {
				t.Error("missing original timezone")
			}
			fmt.Fprint(w, `{"start":{"dateTime":"2026-10-02T00:00:00"},"end":{"dateTime":"2026-10-03T00:00:00"}}`)
		case r.URL.Query().Get("page") == "2":
			fmt.Fprint(w, `{"value":[{"id":"timed","subject":"회의","start":{"dateTime":"2026-10-02T01:00:00.0000000"},"end":{"dateTime":"2026-10-02T02:00:00.0000000"}}]}`)
		default:
			json.NewEncoder(w).Encode(map[string]any{"value": []any{map[string]any{"id": "day", "subject": "기념일", "isAllDay": true, "originalStartTimeZone": "Korea Standard Time", "start": map[string]string{"dateTime": "2026-10-01T15:00:00"}, "end": map[string]string{"dateTime": "2026-10-02T15:00:00"}}}, "@odata.nextLink": base + "/me/calendars/a/calendarView?page=2"})
		}
	}))
	defer server.Close()
	base = server.URL
	p := remote{server.Client(), base, base}
	a := Account{"u", "microsoft", "test"}
	start, _ := time.Parse(time.DateOnly, "2026-10-01")
	es, e := p.events(context.Background(), a, Calendar{ID: "u:a"}, start, start.AddDate(0, 1, 0))
	if e != nil || len(es) != 2 {
		t.Fatalf("%v %v", es, e)
	}
	if es[0].Start != "2026-10-02" || es[1].Start != "2026-10-02T01:00:00Z" {
		t.Fatalf("time normalization: %v", es)
	}
	if safeNext(base, "https://evil.test/me") || safeNext(base, base+".evil.test/me") {
		t.Fatal("accepted untrusted next link")
	}
}

type memoryVault struct {
	token *oauth2.Token
	sets  int
	err   error
}

func (v *memoryVault) Get(string) (*oauth2.Token, error)   { return v.token, v.err }
func (v *memoryVault) Set(_ string, t *oauth2.Token) error { v.sets++; v.token = t; return v.err }
func (v *memoryVault) Delete(string) error                 { return v.err }
func TestRefreshPersistence(t *testing.T) {
	v := &memoryVault{}
	token := &oauth2.Token{AccessToken: "new", RefreshToken: "refresh", Expiry: time.Now().Add(time.Hour)}
	s := &durableSource{source: oauth2.StaticTokenSource(token), vault: v, id: "test", previous: &oauth2.Token{AccessToken: "old"}}
	for i := 0; i < 2; i++ {
		if _, e := s.Token(); e != nil {
			t.Fatal(e)
		}
	}
	if v.sets != 1 {
		t.Fatalf("writes %d", v.sets)
	}
}
func TestMetadataRoundTrip(t *testing.T) {
	p := filepath.Join(t.TempDir(), "accounts.json")
	a := []Account{{"id", "google", "개인"}}
	if e := saveAccounts(p, a); e != nil {
		t.Fatal(e)
	}
	a[0].Label = "회사"
	if e := saveAccounts(p, a); e != nil {
		t.Fatal(e)
	}
	loaded, e := loadAccounts(p)
	if e != nil || loaded[0].Label != "회사" {
		t.Fatalf("%v %v", loaded, e)
	}
	b, _ := os.ReadFile(p)
	if strings.Contains(string(b), "access_token") {
		t.Fatal("token in metadata")
	}
}

// Explicit opt-in checks the OS boundary with a temporary, random credential.
func TestSystemVaultLargeToken(t *testing.T) {
	if os.Getenv("CALENDARHUB_TEST_VAULT") != "1" {
		t.Skip("set CALENDARHUB_TEST_VAULT=1 for an OS credential manager round trip")
	}
	id := "selftest-" + random()
	v := systemVault{}
	defer v.Delete(id)
	token := &oauth2.Token{AccessToken: strings.Repeat("a", 5000), RefreshToken: strings.Repeat("r", 4000)}
	if e := v.Set(id, token); e != nil {
		t.Fatal(e)
	}
	loaded, e := v.Get(id)
	if e != nil || loaded.AccessToken != token.AccessToken || loaded.RefreshToken != token.RefreshToken {
		t.Fatalf("large token round trip: %v", e)
	}
	token.AccessToken = "rotated"
	if e = v.Set(id, token); e != nil {
		t.Fatal(e)
	}
	loaded, e = v.Get(id)
	if e != nil || loaded.AccessToken != "rotated" {
		t.Fatalf("refresh rotation: %v", e)
	}
	if e = v.Delete(id); e != nil {
		t.Fatal(e)
	}
	if _, e = v.Get(id); e == nil {
		t.Fatal("deleted credential still readable")
	}
}
