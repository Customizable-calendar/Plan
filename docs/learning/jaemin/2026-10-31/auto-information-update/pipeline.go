package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type App struct {
	Config Config
	API    *API
}
type Summary struct {
	ID          string `json:"id"`
	Question    string `json:"question"`
	Method      string `json:"method"`
	Findings    string `json:"findings"`
	Limitations string `json:"limitations"`
	Relevance   string `json:"relevance"`
}
type Digest struct {
	Papers        []Summary `json:"papers"`
	Synthesis     string    `json:"synthesis"`
	Differences   string    `json:"differences"`
	NextQuestions string    `json:"next_questions"`
}
type State struct {
	Version int                        `json:"version"`
	Topics  map[string]map[string]bool `json:"topics"`
}

func (a *App) topic() (string, error) {
	topic := a.Config.Topic
	if a.Config.TopicFile != "" {
		b, err := os.ReadFile(a.Config.TopicFile)
		if err != nil {
			return "", fmt.Errorf("관심 문장 파일: %w", err)
		}
		topic = strings.TrimPrefix(string(b), "\ufeff")
	}
	topic = strings.TrimSpace(topic)
	if len([]rune(topic)) == 0 || len([]rune(topic)) > 10000 {
		return "", errors.New("관심 문장은 1~10,000자여야 합니다")
	}
	return topic, nil
}

func (a *App) keywords(ctx context.Context, model, topic string) ([]string, error) {
	var out struct {
		Keywords []string `json:"keywords"`
	}
	schema := objectSchema(map[string]any{"keywords": map[string]any{"type": "ARRAY", "items": stringSchema(), "minItems": 3, "maxItems": 6}}, "keywords")
	err := a.API.generate(ctx, model, "Extract 3 to 6 focused English academic search phrases from the user's research interest. Prefer established 1-4 word terms found literally in paper titles or abstracts. Include the key research concepts and accepted synonyms. Do not output broad generic words such as research, study, or method. Translate Korean input to English keywords. Return keywords only.", map[string]string{"interest": topic}, schema, &out)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var keys []string
	for _, raw := range out.Keywords {
		k := keyword(raw)
		if k != "" && len(k) <= 120 && !seen[strings.ToLower(k)] {
			keys = append(keys, k)
			seen[strings.ToLower(k)] = true
		}
	}
	if len(keys) < 3 || len(keys) > 6 {
		return nil, errors.New("Gemini 키워드는 유효한 3~6개여야 합니다")
	}
	return keys, nil
}

func (a *App) summarize(ctx context.Context, model, topic string, papers []Paper) (Digest, error) {
	props := map[string]any{}
	for _, k := range []string{"id", "question", "method", "findings", "limitations", "relevance"} {
		props[k] = stringSchema()
	}
	schema := objectSchema(map[string]any{
		"papers":    map[string]any{"type": "ARRAY", "items": objectSchema(props, "id", "question", "method", "findings", "limitations", "relevance")},
		"synthesis": stringSchema(), "differences": stringSchema(), "next_questions": stringSchema(),
	}, "papers", "synthesis", "differences", "next_questions")
	type item struct {
		Ref   string `json:"ref"`
		Paper Paper  `json:"paper"`
	}
	items := make([]item, len(papers))
	for i, p := range papers {
		items[i] = item{fmt.Sprintf("P%d", i+1), p}
	}
	var d Digest
	err := a.API.generate(ctx, model, `You are a careful academic abstract reviewer. Write all prose in Korean, using plain text rather than Markdown or HTML.
Use ONLY the supplied titles, metadata and COMPLETE ABSTRACTS, never knowledge of the full paper. Do not invent numbers, causal claims, methods, datasets, citations or evidence.
Return one summary for EVERY supplied paper, id exactly its ref (P1, P2, etc.). For each: research question, method, findings, limitations, and connection to the user's interest. If information is missing say '초록에 명시되지 않음'. Clearly distinguish your inferences. If relevance is weak, say so.
Synthesize common findings, contrast methods/results and propose follow-up questions across the papers. Cite evidence as [P1], [P2], etc. Only use supplied refs. Do not assert consensus with one paper. Avoid equating preprints with peer-reviewed evidence. Keep each field concise (1-3 sentences); synthesis/differences up to 2 paragraphs.`, map[string]any{"interest": topic, "papers": items}, schema, &d)
	if err != nil {
		return d, err
	}
	if err := validateDigest(d, len(papers)); err != nil {
		return d, err
	}
	return d, nil
}

var refPattern = regexp.MustCompile(`\[P[0-9]+\]`)

func validateDigest(d Digest, count int) error {
	if len(d.Papers) != count {
		return errors.New("요약 논문 수 불일치")
	}
	valid := map[string]bool{}
	for i := 1; i <= count; i++ {
		valid[fmt.Sprintf("P%d", i)] = true
	}
	seen := map[string]bool{}
	texts := []string{d.Synthesis, d.Differences, d.NextQuestions}
	for _, s := range d.Papers {
		if !valid[s.ID] || seen[s.ID] {
			return fmt.Errorf("요약 참조 ID 불일치: %s", s.ID)
		}
		seen[s.ID] = true
		texts = append(texts, s.Question, s.Method, s.Findings, s.Limitations, s.Relevance)
	}
	for _, text := range texts {
		if strings.TrimSpace(text) == "" {
			return errors.New("빈 요약 필드")
		}
		for _, ref := range refPattern.FindAllString(text, -1) {
			if !valid[strings.Trim(ref, "[]")] {
				return fmt.Errorf("존재하지 않는 논문 인용: %s", ref)
			}
		}
	}
	return nil
}

func loadState(path string) (State, error) {
	s := State{Version: 1, Topics: map[string]map[string]bool{}}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal(b, &s); err != nil {
		return s, fmt.Errorf("처리 기록 손상: %w (파일을 복구하거나 별도 -out을 사용하세요)", err)
	}
	if s.Version != 1 || s.Topics == nil {
		return s, errors.New("처리 기록 형식이 올바르지 않습니다")
	}
	return s, nil
}

func atomicWrite(path string, b []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".digest-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err := f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

func (a *App) cycle(ctx context.Context) (string, error) {
	now := time.Now()
	topic, err := a.topic()
	if err != nil {
		return "", err
	}
	statePath := filepath.Join(a.Config.Out, "state.json")
	state, err := loadState(statePath)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(clean(topic)))
	topicID := hex.EncodeToString(hash[:])
	if state.Topics[topicID] == nil {
		state.Topics[topicID] = map[string]bool{}
	}
	models, err := a.API.models(ctx)
	if err != nil {
		return "", err
	}
	model, err := chooseModel(models, a.Config.Model)
	if err != nil {
		return "", err
	}
	log.Printf("선택 모델: %s", model)
	keys, err := a.keywords(ctx, model, topic)
	if err != nil {
		return "", fmt.Errorf("키워드 추출: %w", err)
	}
	names, err := sourceNames(a.Config.Sources)
	if err != nil {
		return "", err
	}
	queries := map[string]string{}
	var all []Paper
	var warnings []string
	success := 0
	for _, name := range names {
		q := searchQuery(keys, name, a.Config.Days, now)
		queries[name] = q
		papers, err := a.API.search(ctx, name, q, a.Config.Candidates)
		if err != nil {
			warnings = append(warnings, name+": "+err.Error())
			log.Printf("출처 검색 실패: %s", warnings[len(warnings)-1])
			continue
		}
		success++
		all = append(all, papers...)
	}
	if success == 0 {
		return "", fmt.Errorf("모든 논문 출처 검색 실패: %s", strings.Join(warnings, "; "))
	}
	papers := selectPapers(all, state.Topics[topicID], keys, a.Config.Max)
	var d Digest
	if len(papers) > 0 {
		d, err = a.summarize(ctx, model, topic, papers)
		if err != nil {
			return "", fmt.Errorf("논문 요약: %w", err)
		}
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if err := os.MkdirAll(a.Config.Out, 0700); err != nil {
		return "", err
	}
	path := filepath.Join(a.Config.Out, "digest-"+now.Format("20060102-150405.000000000")+".md")
	report := renderReport(now, topic, model, keys, queries, warnings, papers, d, a.Config)
	if err := atomicWrite(path, []byte(report)); err != nil {
		return "", err
	}
	// Commit state only after a complete report is on disk. On state-write failure,
	// the report remains recoverable and the next run may repeat these papers.
	for _, p := range papers {
		for _, k := range aliases(p) {
			state.Topics[topicID][k] = true
		}
	}
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return "", err
	}
	if err := atomicWrite(statePath, b); err != nil {
		return "", fmt.Errorf("보고서는 %s에 저장했으나 처리 기록 저장 실패: %w", path, err)
	}
	return path, nil
}

func md(s string) string {
	s = html.EscapeString(s)
	return strings.NewReplacer("\\", "\\\\", "`", "\\`", "*", "\\*", "_", "\\_", "[", "\\[", "]", "\\]", "#", "\\#", "|", "\\|").Replace(s)
}

func renderReport(now time.Time, topic, model string, keys []string, queries map[string]string, warnings []string, papers []Paper, d Digest, c Config) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# 관심 논문 다이제스트\n\n- 생성 시각: %s\n- Gemini 모델: %s\n- 검색 기간: 최근 %d일 (0은 전체)\n- 출처별 후보 한도: %d편\n- 이번 보고서: %d편\n\n## 관심 문장\n\n%s\n\n## 추출 키워드\n\n%s\n\n", now.Format(time.RFC3339), md(model), c.Days, c.Candidates, len(papers), md(topic), md(strings.Join(keys, ", ")))
	b.WriteString("> 초록과 메타데이터에 근거한 AI 요약입니다. 원문 전체를 검토한 결과가 아니며, 생성 요약의 정확성은 원문으로 확인하세요. 초록 원문은 아래에 생략 없이 포함합니다(공백과 HTML 서식만 정리).\n\n")
	if len(warnings) > 0 {
		b.WriteString("## 검색 경고\n\n일부 출처의 검색이 실패했습니다. 해당 출처를 제외한 결과입니다.\n\n")
		for _, w := range warnings {
			fmt.Fprintf(&b, "- %s\n", md(w))
		}
		b.WriteString("\n")
	}
	if len(papers) == 0 {
		b.WriteString("## 검색 결과\n\n이번 후보 범위에서 초록과 키워드가 일치하는 미처리 논문이 없습니다. 논문이 전혀 없다는 뜻은 아닙니다. 기간·키워드·후보 수를 조정할 수 있습니다.\n\n")
	} else {
		fmt.Fprintf(&b, "## 종합 요약\n\n%s\n\n## 논문 간 차이점\n\n%s\n\n## 후속 연구 질문\n\n%s\n\n", md(d.Synthesis), md(d.Differences), md(d.NextQuestions))
		byID := map[string]Summary{}
		for _, s := range d.Papers {
			byID[s.ID] = s
		}
		for i, p := range papers {
			ref := fmt.Sprintf("P%d", i+1)
			s := byID[ref]
			fmt.Fprintf(&b, "## [%s] %s\n\n- 저자: %s\n- 발표일: %s\n- 출처: %s\n- 링크: <%s>\n", ref, md(p.Title), md(p.Authors), md(p.Date), md(p.Source), p.URL)
			if p.DOI != "" {
				fmt.Fprintf(&b, "- DOI: %s\n", md(p.DOI))
			}
			for _, f := range [][2]string{{"연구 질문", s.Question}, {"방법", s.Method}, {"주요 결과", s.Findings}, {"한계와 주의점", s.Limitations}, {"관심 주제와의 연관성", s.Relevance}} {
				fmt.Fprintf(&b, "\n### %s\n\n%s\n", f[0], md(f[1]))
			}
			fmt.Fprintf(&b, "\n### 초록 원문\n\n%s\n\n", md(p.Abstract))
		}
	}
	b.WriteString("## 검색 기록\n\n")
	for _, source := range []string{"arxiv", "europepmc"} {
		if q, ok := queries[source]; ok {
			fmt.Fprintf(&b, "- %s: %s\n", source, md(q))
		}
	}
	b.WriteString("\n검색은 출처별 최신 후보 일부를 대상으로 하며 체계적 문헌고찰이나 전체 문헌 검색을 보장하지 않습니다. 동일 관심 문장에 대해 이전 보고서에 포함한 논문은 ID·DOI·정규화 제목으로 제외합니다.\n")
	return b.String()
}
