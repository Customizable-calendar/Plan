package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// API credentials deliberately have no field in the persisted settings.
type Preferences struct {
	Topic      string `json:"topic"`
	Model      string `json:"model"`
	Output     string `json:"output_folder"`
	Sources    string `json:"sources"`
	Days       int    `json:"days"`
	MaxPapers  int    `json:"max_papers"`
	Candidates int    `json:"candidates"`
}

func defaultPreferences(base string) Preferences {
	return Preferences{Topic: "대규모 언어 모델의 환각을 줄이기 위한 RAG와 사실성 평가 방법에 관심이 있습니다.", Output: filepath.Join(base, "reports"), Sources: "arxiv,europepmc", Days: 365, MaxPapers: 8, Candidates: 50}
}

func (p Preferences) validate() error {
	if n := len([]rune(strings.TrimSpace(p.Topic))); n < 1 || n > 10000 {
		return fmt.Errorf("관심 문장은 1~10,000자로 입력하세요")
	}
	if strings.TrimSpace(p.Output) == "" {
		return fmt.Errorf("저장 폴더를 지정하세요")
	}
	if p.Days < 0 || p.Days > 36500 || p.MaxPapers < 1 || p.MaxPapers > 20 || p.Candidates < p.MaxPapers || p.Candidates > 100 {
		return fmt.Errorf("검색 기간 0~36500일, 논문 1~20편, 후보 수는 논문 수 이상~100으로 지정하세요")
	}
	_, err := sourceNames(p.Sources)
	return err
}

func readPreferences(path, base string) (Preferences, error) {
	p := defaultPreferences(base)
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	if err = json.Unmarshal(b, &p); err != nil {
		return defaultPreferences(base), err
	}
	if err = p.validate(); err != nil {
		return defaultPreferences(base), err
	}
	return p, nil
}

func savePreferences(path string, p Preferences) error {
	if err := p.validate(); err != nil {
		return err
	}
	b, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(path, b)
}

func acquireRunLock(out string) (func(), error) {
	if err := os.MkdirAll(out, 0700); err != nil {
		return nil, err
	}
	path := filepath.Join(out, ".running.lock")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return nil, fmt.Errorf("보고서 폴더가 사용 중이거나 쓰기 권한이 없습니다: %w. 강제 종료 후에는 다른 실행이 없는지 확인하고 .running.lock을 삭제하세요", err)
	}
	if _, err = fmt.Fprintf(f, "pid=%d\n", os.Getpid()); err != nil {
		f.Close()
		os.Remove(path)
		return nil, err
	}
	if err = f.Close(); err != nil {
		os.Remove(path)
		return nil, err
	}
	return func() { os.Remove(path) }, nil
}
