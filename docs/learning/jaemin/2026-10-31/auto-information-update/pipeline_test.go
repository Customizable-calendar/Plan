package main

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
)

const arxivFixture = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><id>http://arxiv.org/abs/2610.12345v2</id><title>Retrieval augmented generation for factuality</title><summary>We evaluate retrieval augmented generation. Factuality improved on the tested dataset. Limitations remain.</summary><published>2026-10-20T00:00:00Z</published><author><name>A. Researcher</name></author><arxiv:doi>10.1000/test</arxiv:doi></entry><entry><id>http://arxiv.org/abs/2610.11111</id><title>Missing abstract</title></entry></feed>`
const pmcFixture = `{"resultList":{"result":[{"id":"123","source":"MED","title":"Retrieval augmented generation for factuality","authorString":"A. Researcher","firstPublicationDate":"2026-10-20","doi":"10.1000/TEST","abstractText":"<h4>Results</h4>We evaluate retrieval augmented generation &amp; factuality."},{"id":"124","source":"MED","title":"No abstract"}]}}`

func testDigest() Digest {
	return Digest{Papers: []Summary{{ID: "P1", Question: "질문", Method: "방법", Findings: "결과", Limitations: "초록에 명시되지 않음", Relevance: "관련"}}, Synthesis: "관찰 결과 [P1]", Differences: "한 편이므로 비교 불가", NextQuestions: "후속 검증"}
}

func TestParsingAndDedup(t *testing.T) {
	arxiv, err := parseArxiv([]byte(arxivFixture))
	if err != nil {
		t.Fatal(err)
	}
	pmc, err := parsePMC([]byte(pmcFixture))
	if err != nil {
		t.Fatal(err)
	}
	if len(arxiv) != 1 || len(pmc) != 1 {
		t.Fatal("abstract-less entries were retained")
	}
	if arxiv[0].ID != "arxiv:2610.12345" || !strings.Contains(pmc[0].Abstract, "& factuality") || strings.Contains(pmc[0].Abstract, "<") {
		t.Fatal(arxiv, pmc)
	}
	selected := selectPapers(append(arxiv, pmc...), nil, []string{"retrieval augmented generation"}, 8)
	if len(selected) != 1 {
		t.Fatalf("cross-source duplicate: %d", len(selected))
	}
	seen := map[string]bool{}
	for _, k := range aliases(selected[0]) {
		seen[k] = true
	}
	if len(selectPapers(arxiv, seen, []string{"retrieval"}, 8)) != 0 {
		t.Fatal("seen paper included")
	}
	if _, err := parseArxiv([]byte(`<feed><entry><id>http://arxiv.org/api/errors#bad_query</id></entry></feed>`)); err == nil {
		t.Fatal("arxiv error accepted")
	}
	if _, err := parsePMC([]byte(`{"error":"invalid query"}`)); err == nil {
		t.Fatal("PMC error accepted")
	}
}

func TestModelPaginationAndAuth(t *testing.T) {
	calls := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("x-goog-api-key") != "test-secret" || r.URL.Query().Has("key") {
			t.Error("invalid key transport")
		}
		if r.URL.Query().Get("pageToken") == "" {
			fmt.Fprint(w, `{"models":[{"name":"models/gemini-test-flash","supportedGenerationMethods":["generateContent"]},{"name":"models/gemini-embedding","supportedGenerationMethods":["embedContent"]}],"nextPageToken":"next"}`)
		} else {
			fmt.Fprint(w, `{"models":[{"name":"models/gemini-test-image","supportedGenerationMethods":["generateContent"]}]}`)
		}
	}))
	defer s.Close()
	a := &API{Client: s.Client(), Key: "test-secret", GeminiURL: s.URL}
	models, err := a.models(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || len(models) != 2 {
		t.Fatal(calls, models)
	}
	selected, err := chooseModel(models, "")
	if err != nil || selected != "models/gemini-test-flash" {
		t.Fatal(selected, err)
	}
	if _, err := chooseModel(models, "missing"); err == nil {
		t.Fatal("missing model accepted")
	}
}

func TestRetryAndRedaction(t *testing.T) {
	calls := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls < 3 {
			w.WriteHeader(429)
			fmt.Fprint(w, "test-secret")
			return
		}
		fmt.Fprint(w, `{}`)
	}))
	defer s.Close()
	a := &API{Client: s.Client(), Key: "test-secret", RetryDelay: time.Millisecond}
	if _, err := a.request(context.Background(), "GET", s.URL, nil, true); err != nil || calls != 3 {
		t.Fatal(calls, err)
	}
	failure := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(403); fmt.Fprint(w, "test-secret") }))
	defer failure.Close()
	_, err := a.request(context.Background(), "GET", failure.URL, nil, true)
	if err == nil || strings.Contains(err.Error(), "test-secret") {
		t.Fatal("credential leakage", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := pause(ctx, time.Hour); err == nil {
		t.Fatal("cancellation ignored")
	}
}

func fixtureApp(t *testing.T, failSummary, failArxiv, failPMC bool) *App {
	t.Helper()
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/models":
			fmt.Fprint(w, `{"models":[{"name":"models/gemini-test-flash","supportedGenerationMethods":["generateContent"]}]}`)
		case "/arxiv":
			if r.Header.Get("x-goog-api-key") != "" {
				t.Error("key leaked to paper source")
			}
			if failArxiv {
				w.WriteHeader(400)
				return
			}
			fmt.Fprint(w, arxivFixture)
		case "/pmc":
			if failPMC {
				w.WriteHeader(400)
				return
			}
			fmt.Fprint(w, pmcFixture)
		default:
			var body struct {
				GenerationConfig struct {
					Schema struct {
						Properties map[string]any `json:"properties"`
					} `json:"responseSchema"`
				} `json:"generationConfig"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
			}
			var result any = testDigest()
			finish := "STOP"
			if _, ok := body.GenerationConfig.Schema.Properties["keywords"]; ok {
				result = map[string]any{"keywords": []string{"retrieval augmented generation", "factuality", "hallucination"}}
			} else if failSummary {
				finish = "MAX_TOKENS"
			}
			b, _ := json.Marshal(result)
			json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{"finishReason": finish, "content": map[string]any{"parts": []any{map[string]any{"text": string(b)}}}}}})
		}
	}))
	t.Cleanup(s.Close)
	return &App{Config: Config{Topic: "RAG의 사실성", Out: t.TempDir(), Sources: "arxiv,europepmc", Days: 365, Max: 8, Candidates: 50}, API: &API{Client: s.Client(), Key: "secret", GeminiURL: s.URL, ArxivURL: s.URL + "/arxiv", PMCURL: s.URL + "/pmc", RetryDelay: time.Millisecond}}
}

func TestCycleReportAndPersistentDedup(t *testing.T) {
	a := fixtureApp(t, false, false, false)
	path, err := a.cycle(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"초록 원문", "Limitations remain.", "종합 요약", "https://arxiv.org/abs/2610.12345", "이번 보고서: 1편"} {
		if !strings.Contains(string(b), expected) {
			t.Fatalf("missing %q", expected)
		}
	}
	// Clear request timestamp to avoid a real rate-limit delay in this mock test.
	a.API.lastArxiv = time.Time{}
	path, err = a.cycle(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(path)
	if !strings.Contains(string(b), "이번 보고서: 0편") {
		t.Fatal("duplicate report")
	}
	a.Config.Topic = "새 관심 문장"
	a.API.lastArxiv = time.Time{}
	path, err = a.cycle(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(path)
	if !strings.Contains(string(b), "이번 보고서: 1편") {
		t.Fatal("topic state not isolated")
	}
}

func TestFailedSummaryDoesNotCommit(t *testing.T) {
	a := fixtureApp(t, true, false, false)
	if _, err := a.cycle(context.Background()); err == nil {
		t.Fatal("truncated summary accepted")
	}
	files, _ := os.ReadDir(a.Config.Out)
	if len(files) != 0 {
		t.Fatal("failed generation wrote report/state")
	}
}

func TestPartialAndTotalSourceFailure(t *testing.T) {
	a := fixtureApp(t, false, true, false)
	path, err := a.cycle(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(path)
	if !strings.Contains(string(b), "검색 경고") || !strings.Contains(string(b), "초록 원문") {
		t.Fatal("partial failure not disclosed")
	}
	a = fixtureApp(t, false, true, true)
	if _, err := a.cycle(context.Background()); err == nil {
		t.Fatal("all sources failing accepted")
	}
}

func TestValidationAndCorruptState(t *testing.T) {
	d := testDigest()
	d.Synthesis = "invented [P99]"
	if validateDigest(d, 1) == nil {
		t.Fatal("invented ref accepted")
	}
	d = testDigest()
	d.Papers[0].Findings = ""
	if validateDigest(d, 1) == nil {
		t.Fatal("empty summary accepted")
	}
	path := filepath.Join(t.TempDir(), "state.json")
	if err := os.WriteFile(path, []byte(`broken`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadState(path); err == nil {
		t.Fatal("corrupt state ignored")
	}
	if got := keyword(`RAG" OR *:*`); strings.ContainsAny(got, `":*`) {
		t.Fatal(got)
	}
}

func TestTopicFileAndAtomicReplace(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "interest.txt")
	if err := atomicWrite(path, []byte("\ufeff첫 주제")); err != nil {
		t.Fatal(err)
	}
	a := App{Config: Config{TopicFile: path}}
	if got, err := a.topic(); err != nil || got != "첫 주제" {
		t.Fatal(got, err)
	}
	if err := atomicWrite(path, []byte("두 번째 주제")); err != nil {
		t.Fatal(err)
	}
	if got, err := a.topic(); err != nil || got != "두 번째 주제" {
		t.Fatal(got, err)
	}
}

func TestMultiplePapersAndCompleteAbstracts(t *testing.T) {
	d := testDigest()
	second := d.Papers[0]
	second.ID = "P2"
	second.Findings = "두 번째 논문의 결과"
	d.Papers = append([]Summary{second}, d.Papers...)
	d.Synthesis = "두 연구의 공통점 [P1] [P2]"
	if err := validateDigest(d, 2); err != nil {
		t.Fatal(err)
	}
	abstract := strings.Repeat("Complete abstract sentence. ", 500) + "UNIQUE END MARKER"
	papers := []Paper{
		{ID: "one", Title: "Paper one", Abstract: abstract, URL: "https://arxiv.org/abs/1"},
		{ID: "two", Title: "Paper two <script>alert(1)</script>", Abstract: "Second abstract", URL: "https://arxiv.org/abs/2"},
	}
	report := renderReport(time.Now(), "interest", "model", []string{"keyword"}, nil, nil, papers, d, Config{})
	if !strings.Contains(report, abstract) || strings.Count(report, "### 초록 원문") != 2 {
		t.Fatal("abstract omitted/truncated")
	}
	if strings.Contains(report, "<script>") {
		t.Fatal("unsafe HTML rendered")
	}
	first, secondSection, _ := strings.Cut(report, "## [P2]")
	if strings.Contains(first, "두 번째 논문의 결과") || !strings.Contains(secondSection, "두 번째 논문의 결과") {
		t.Fatal("summaries attached to wrong papers")
	}
}

// Opt-in live source check, no Gemini credential required.
func TestLiveSources(t *testing.T) {
	if os.Getenv("PAPER_DIGEST_LIVE_TEST") != "1" {
		t.Skip("set PAPER_DIGEST_LIVE_TEST=1 for public API checks")
	}
	a := &API{Client: &http.Client{Timeout: 45 * time.Second}, ArxivURL: "https://export.arxiv.org/api/query", PMCURL: "https://www.ebi.ac.uk/europepmc/webservices/rest/search", RetryDelay: 3 * time.Second}
	for _, source := range []string{"arxiv", "europepmc"} {
		t.Run(source, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()
			papers, err := a.search(ctx, source, searchQuery([]string{"machine learning"}, source, 0, time.Now()), 3)
			if err != nil {
				t.Fatal(err)
			}
			if len(papers) == 0 {
				t.Fatal("no abstracts returned")
			}
			for _, p := range papers {
				if p.Abstract == "" {
					t.Fatal("empty abstract")
				}
			}
			t.Logf("%s returned %d papers with abstracts", source, len(papers))
		})
	}
}
