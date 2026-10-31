package hub

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

type clientSettings struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}
type settings struct {
	Google    clientSettings `json:"google"`
	Microsoft clientSettings `json:"microsoft"`
}

func (s settings) oauth(provider string) *oauth2.Config {
	c := &oauth2.Config{RedirectURL: origin + "/oauth/callback"}
	switch provider {
	case "google":
		c.ClientID = s.Google.ClientID
		c.ClientSecret = s.Google.ClientSecret
		c.Scopes = []string{"https://www.googleapis.com/auth/calendar.readonly"}
		c.Endpoint = oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/v2/auth", TokenURL: "https://oauth2.googleapis.com/token", AuthStyle: oauth2.AuthStyleInParams}
	case "microsoft":
		c.ClientID = s.Microsoft.ClientID
		c.Scopes = []string{"https://graph.microsoft.com/Calendars.Read", "offline_access"}
		c.Endpoint = oauth2.Endpoint{AuthURL: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", TokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token", AuthStyle: oauth2.AuthStyleInParams}
	default:
		return nil
	}
	return c
}

type durableSource struct {
	source   oauth2.TokenSource
	vault    Vault
	id       string
	previous *oauth2.Token
}

func (s *durableSource) Token() (*oauth2.Token, error) {
	t, e := s.source.Token()
	if e != nil {
		return nil, e
	}
	if s.previous == nil || t.AccessToken != s.previous.AccessToken || t.RefreshToken != s.previous.RefreshToken || !t.Expiry.Equal(s.previous.Expiry) {
		if e = s.vault.Set(s.id, t); e != nil {
			return nil, fmt.Errorf("cannot persist refreshed credential: %w", e)
		}
		copy := *t
		s.previous = &copy
	}
	return t, nil
}

type remote struct {
	client        *http.Client
	google, graph string
}

func (p remote) get(ctx context.Context, endpoint string, out any) error {
	return p.getZone(ctx, endpoint, "UTC", out)
}
func (p remote) getZone(ctx context.Context, endpoint, zone string, out any) error {
	req, e := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if e != nil {
		return e
	}
	if strings.ContainsAny(zone, "\r\n\"") {
		return fmt.Errorf("invalid timezone")
	}
	req.Header.Set("Prefer", `outlook.timezone="`+zone+`"`)
	res, e := p.client.Do(req)
	if e != nil {
		return fmt.Errorf("network request failed")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("API HTTP %d", res.StatusCode)
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 16<<20)).Decode(out); e != nil {
		return fmt.Errorf("invalid API response")
	}
	return nil
}
func addQuery(raw, key, value string) string {
	u, _ := url.Parse(raw)
	q := u.Query()
	q.Set(key, value)
	u.RawQuery = q.Encode()
	return u.String()
}
func calendarKey(a Account, id string) string { return a.ID + ":" + id }

// nextLink may carry an access token through the client; never follow another origin.
func safeNext(base, next string) bool {
	b, e := url.Parse(base)
	if e != nil {
		return false
	}
	n, e := url.Parse(next)
	return e == nil && n.Scheme == b.Scheme && n.Host == b.Host && n.User == nil && strings.HasPrefix(n.Path, b.Path+"/")
}
func (p remote) calendars(ctx context.Context, a Account) ([]Calendar, error) {
	result := []Calendar{}
	endpoint := p.google + "/users/me/calendarList?maxResults=250"
	if a.Provider == "microsoft" {
		endpoint = p.graph + "/me/calendars?$top=100"
	}
	for page := 0; endpoint != ""; page++ {
		if page >= 100 {
			return nil, fmt.Errorf("calendar pagination limit exceeded")
		}
		if a.Provider == "google" {
			var r struct {
				Items         []struct{ ID, Summary, BackgroundColor string }
				NextPageToken string
			}
			if e := p.get(ctx, endpoint, &r); e != nil {
				return nil, e
			}
			for _, c := range r.Items {
				result = append(result, Calendar{calendarKey(a, c.ID), a.ID, c.Summary, c.BackgroundColor})
			}
			endpoint = ""
			if r.NextPageToken != "" {
				endpoint = addQuery(p.google+"/users/me/calendarList?maxResults=250", "pageToken", r.NextPageToken)
			}
		} else {
			var r struct {
				Value []struct{ ID, Name, HexColor string }
				Next  string `json:"@odata.nextLink"`
			}
			if e := p.get(ctx, endpoint, &r); e != nil {
				return nil, e
			}
			for _, c := range r.Value {
				result = append(result, Calendar{calendarKey(a, c.ID), a.ID, c.Name, c.HexColor})
			}
			if r.Next != "" && !safeNext(p.graph, r.Next) {
				return nil, fmt.Errorf("unsafe pagination link")
			}
			endpoint = r.Next
		}
	}
	return result, nil
}

type googleDate struct{ Date, DateTime string }

func (p remote) events(ctx context.Context, a Account, c Calendar, start, end time.Time) ([]Event, error) {
	rawID := strings.TrimPrefix(c.ID, a.ID+":")
	result := []Event{}
	endpoint := p.google + "/calendars/" + url.PathEscape(rawID) + "/events?singleEvents=true&orderBy=startTime&maxResults=2500"
	endpoint = addQuery(endpoint, "timeMin", start.Format(time.RFC3339))
	endpoint = addQuery(endpoint, "timeMax", end.Format(time.RFC3339))
	if a.Provider == "microsoft" {
		endpoint = p.graph + "/me/calendars/" + url.PathEscape(rawID) + "/calendarView?$top=1000"
		endpoint = addQuery(endpoint, "startDateTime", start.Format(time.RFC3339))
		endpoint = addQuery(endpoint, "endDateTime", end.Format(time.RFC3339))
	}
	first := endpoint
	for page := 0; endpoint != ""; page++ {
		if page >= 100 {
			return nil, fmt.Errorf("event pagination limit exceeded")
		}
		if a.Provider == "google" {
			var r struct {
				Items []struct {
					ID, Summary, Status, Location, HTMLLink string
					Start, End                              googleDate
				}
				NextPageToken string
			}
			if e := p.get(ctx, endpoint, &r); e != nil {
				return nil, e
			}
			for _, v := range r.Items {
				if v.Status == "cancelled" {
					continue
				}
				s, t := v.Start.DateTime, v.End.DateTime
				all := v.Start.Date != ""
				if all {
					s, t = v.Start.Date, v.End.Date
				}
				if !validDates(s, t, all) {
					return nil, fmt.Errorf("invalid event date")
				}
				result = append(result, Event{c.ID + ":" + v.ID, c.ID, v.Summary, s, t, all, v.Location, v.HTMLLink})
			}
			endpoint = ""
			if r.NextPageToken != "" {
				endpoint = addQuery(first, "pageToken", r.NextPageToken)
			}
		} else {
			var r struct {
				Value []struct {
					ID, Subject, WebLink, OriginalStartTimeZone string
					IsAllDay, IsCancelled                       bool
					Start, End                                  struct{ DateTime, TimeZone string }
					Location                                    struct{ DisplayName string }
				}
				Next string `json:"@odata.nextLink"`
			}
			if e := p.get(ctx, endpoint, &r); e != nil {
				return nil, e
			}
			for _, v := range r.Value {
				if v.IsCancelled {
					continue
				}
				s, t := v.Start.DateTime, v.End.DateTime
				if v.IsAllDay {
					// UTC conversion can shift an all-day event into the previous date.
					// Ask Graph for this occurrence in its original Windows or IANA zone.
					if v.OriginalStartTimeZone != "" && v.OriginalStartTimeZone != "UTC" {
						var original struct{ Start, End struct{ DateTime string } }
						ep := p.graph + "/me/events/" + url.PathEscape(v.ID) + "?$select=start,end"
						if e := p.getZone(ctx, ep, v.OriginalStartTimeZone, &original); e != nil {
							return nil, e
						}
						s, t = original.Start.DateTime, original.End.DateTime
					}
					if len(s) < 10 || len(t) < 10 {
						return nil, fmt.Errorf("invalid event date")
					}
					s, t = s[:10], t[:10]
				} else {
					var e error
					s, e = graphUTC(s)
					if e != nil {
						return nil, e
					}
					t, e = graphUTC(t)
					if e != nil {
						return nil, e
					}
				}
				if !validDates(s, t, v.IsAllDay) {
					return nil, fmt.Errorf("invalid event date")
				}
				result = append(result, Event{c.ID + ":" + v.ID, c.ID, v.Subject, s, t, v.IsAllDay, v.Location.DisplayName, v.WebLink})
			}
			if r.Next != "" && !safeNext(p.graph, r.Next) {
				return nil, fmt.Errorf("unsafe pagination link")
			}
			endpoint = r.Next
		}
	}
	return result, nil
}
func graphUTC(v string) (string, error) {
	t, e := time.Parse(time.RFC3339Nano, v)
	if e != nil {
		t, e = time.Parse("2006-01-02T15:04:05.999999999", v)
	}
	if e != nil {
		return "", fmt.Errorf("invalid Microsoft event time")
	}
	return t.UTC().Format(time.RFC3339Nano), nil
}
func validDates(s, e string, all bool) bool {
	layout := time.RFC3339Nano
	if all {
		layout = time.DateOnly
	}
	a, err := time.Parse(layout, s)
	if err != nil {
		return false
	}
	b, err := time.Parse(layout, e)
	return err == nil && !b.Before(a)
}
