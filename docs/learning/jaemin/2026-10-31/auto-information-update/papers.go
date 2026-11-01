package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type Paper struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Authors  string `json:"authors"`
	Date     string `json:"date"`
	URL      string `json:"url"`
	DOI      string `json:"doi,omitempty"`
	Source   string `json:"source"`
	Abstract string `json:"abstract"`
}

func sourceNames(s string) ([]string, error) {
	var names []string
	seen := map[string]bool{}
	for _, name := range strings.Split(s, ",") {
		name = strings.TrimSpace(name)
		if name != "arxiv" && name != "europepmc" {
			return nil, fmt.Errorf("알 수 없는 출처: %q", name)
		}
		if !seen[name] {
			names = append(names, name)
			seen[name] = true
		}
	}
	return names, nil
}

var tags = regexp.MustCompile(`<[^>]*>`)
var version = regexp.MustCompile(`v[0-9]+$`)

func clean(s string) string     { return strings.Join(strings.Fields(s), " ") }
func plainHTML(s string) string { return clean(html.UnescapeString(tags.ReplaceAllString(s, " "))) }

// Only words become query operands; model output cannot inject API syntax.
func keyword(s string) string {
	return clean(strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || r == '-' {
			return r
		}
		return ' '
	}, s))
}

func searchQuery(keys []string, source string, days int, now time.Time) string {
	terms := make([]string, 0, len(keys))
	for _, key := range keys {
		if source == "arxiv" {
			terms = append(terms, `(ti:"`+keyword(key)+`" OR abs:"`+keyword(key)+`")`)
		} else {
			terms = append(terms, `(TITLE_ABS:"`+keyword(key)+`")`)
		}
	}
	q := "(" + strings.Join(terms, " OR ") + ")"
	if source == "arxiv" {
		if days > 0 {
			q += " AND submittedDate:[" + now.AddDate(0, 0, -days).UTC().Format("20060102") + "0000 TO " + now.UTC().Format("20060102") + "2359]"
		}
	} else {
		q += " AND HAS_ABSTRACT:Y"
		if days > 0 {
			q += " AND FIRST_PDATE:[" + now.AddDate(0, 0, -days).Format("2006-01-02") + " TO " + now.Format("2006-01-02") + "]"
		}
		q += " sort_date:y"
	}
	return q
}

func (a *API) search(ctx context.Context, source, query string, limit int) ([]Paper, error) {
	if source == "arxiv" {
		v := url.Values{"search_query": {query}, "start": {"0"}, "max_results": {strconv.Itoa(limit)}, "sortBy": {"submittedDate"}, "sortOrder": {"descending"}}
		b, err := a.request(ctx, "GET", a.ArxivURL+"?"+v.Encode(), nil, false)
		if err != nil {
			return nil, err
		}
		return parseArxiv(b)
	}
	v := url.Values{"query": {query}, "format": {"json"}, "resultType": {"core"}, "pageSize": {strconv.Itoa(limit)}}
	b, err := a.request(ctx, "GET", a.PMCURL+"?"+v.Encode(), nil, false)
	if err != nil {
		return nil, err
	}
	return parsePMC(b)
}

func parseArxiv(b []byte) ([]Paper, error) {
	var feed struct {
		XMLName xml.Name `xml:"feed"`
		Entries []struct {
			ID        string `xml:"id"`
			Title     string `xml:"title"`
			Summary   string `xml:"summary"`
			Published string `xml:"published"`
			DOI       string `xml:"doi"`
			Authors   []struct {
				Name string `xml:"name"`
			} `xml:"author"`
		} `xml:"entry"`
	}
	if err := xml.Unmarshal(b, &feed); err != nil {
		return nil, fmt.Errorf("arXiv XML: %w", err)
	}
	var papers []Paper
	for _, e := range feed.Entries {
		if strings.Contains(e.ID, "/api/errors") {
			return nil, errors.New("arXiv가 검색 오류를 반환했습니다")
		}
		if clean(e.Summary) == "" || clean(e.Title) == "" || !strings.Contains(e.ID, "arxiv.org/abs/") {
			continue
		}
		id := strings.SplitN(e.ID, "arxiv.org/abs/", 2)[1]
		id = version.ReplaceAllString(id, "")
		authors := make([]string, 0, len(e.Authors))
		for _, author := range e.Authors {
			authors = append(authors, clean(author.Name))
		}
		papers = append(papers, Paper{ID: "arxiv:" + id, Title: clean(e.Title), Authors: strings.Join(authors, ", "), Date: strings.Split(e.Published, "T")[0], URL: "https://arxiv.org/abs/" + id, DOI: strings.TrimSpace(e.DOI), Source: "arXiv (프리프린트; 동료심사 여부 별도 확인)", Abstract: clean(e.Summary)})
	}
	return papers, nil
}

func parsePMC(b []byte) ([]Paper, error) {
	var res struct {
		ResultList *struct {
			Result []struct {
				ID       string `json:"id"`
				Source   string `json:"source"`
				Title    string `json:"title"`
				Authors  string `json:"authorString"`
				Date     string `json:"firstPublicationDate"`
				Year     string `json:"pubYear"`
				Abstract string `json:"abstractText"`
				DOI      string `json:"doi"`
			} `json:"result"`
		} `json:"resultList"`
	}
	if err := json.Unmarshal(b, &res); err != nil {
		return nil, fmt.Errorf("Europe PMC JSON: %w", err)
	}
	if res.ResultList == nil {
		return nil, errors.New("Europe PMC 응답에 resultList가 없습니다")
	}
	var papers []Paper
	for _, e := range res.ResultList.Result {
		abstract := plainHTML(e.Abstract)
		if abstract == "" || clean(e.Title) == "" || e.ID == "" || e.Source == "" {
			continue
		}
		date := e.Date
		if date == "" {
			date = e.Year
		}
		papers = append(papers, Paper{ID: "pmc:" + e.Source + ":" + e.ID, Title: plainHTML(e.Title), Authors: clean(e.Authors), Date: date, URL: "https://europepmc.org/article/" + url.PathEscape(e.Source) + "/" + url.PathEscape(e.ID), DOI: e.DOI, Source: "Europe PMC / " + e.Source, Abstract: abstract})
	}
	return papers, nil
}

func aliases(p Paper) []string {
	keys := []string{p.ID}
	if p.DOI != "" {
		doi := strings.ToLower(strings.TrimSpace(p.DOI))
		for _, prefix := range []string{"https://doi.org/", "http://doi.org/", "http://dx.doi.org/", "https://dx.doi.org/", "doi:"} {
			doi = strings.TrimPrefix(doi, prefix)
		}
		keys = append(keys, "doi:"+strings.TrimSpace(doi))
	}
	title := strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return unicode.ToLower(r)
		}
		return -1
	}, p.Title)
	if title != "" {
		keys = append(keys, "title:"+title)
	}
	return keys
}

func selectPapers(papers []Paper, seen map[string]bool, keys []string, limit int) []Paper {
	// Rank lexical relevance before recency within the bounded candidate window.
	score := func(p Paper) int {
		n := 0
		for _, k := range keys {
			k = strings.ToLower(k)
			if strings.Contains(strings.ToLower(p.Title), k) {
				n += 3
			}
			if strings.Contains(strings.ToLower(p.Abstract), k) {
				n++
			}
		}
		return n
	}
	sort.SliceStable(papers, func(i, j int) bool {
		a, b := score(papers[i]), score(papers[j])
		if a != b {
			return a > b
		}
		return papers[i].Date > papers[j].Date
	})
	local := map[string]bool{}
	var result []Paper
	for _, p := range papers {
		if strings.TrimSpace(p.Abstract) == "" || score(p) == 0 {
			continue
		}
		duplicate := false
		for _, k := range aliases(p) {
			if seen[k] || local[k] {
				duplicate = true
			}
		}
		if duplicate {
			continue
		}
		for _, k := range aliases(p) {
			local[k] = true
		}
		result = append(result, p)
		if len(result) == limit {
			break
		}
	}
	return result
}
