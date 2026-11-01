package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"
)

type Config struct {
	Topic, TopicFile, Model, Out, Sources string
	Interval                              time.Duration
	Days, Max, Candidates                 int
	Once, ListModels                      bool
}

func cliMain() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	var c Config
	flag.StringVar(&c.Topic, "topic", "", "관심 문장")
	flag.StringVar(&c.TopicFile, "topic-file", "", "매 실행마다 다시 읽는 UTF-8 관심 문장 파일")
	flag.StringVar(&c.Model, "model", "", "models/ 접두사 없이도 지정 가능 (기본: 자동 선택)")
	flag.StringVar(&c.Out, "out", "reports", "보고서 및 처리 기록 폴더")
	flag.StringVar(&c.Sources, "sources", "arxiv,europepmc", "arxiv,europepmc 또는 둘 중 하나")
	flag.DurationVar(&c.Interval, "interval", 6*time.Hour, "실행 간격")
	flag.IntVar(&c.Days, "days", 365, "발표일 검색 범위, 0이면 전체 기간")
	flag.IntVar(&c.Max, "max-papers", 8, "보고서당 최대 논문 수 (1~20)")
	flag.IntVar(&c.Candidates, "candidates", 50, "출처별 최대 검색 후보 수 (1~100)")
	flag.BoolVar(&c.Once, "once", false, "한 번 실행 후 종료")
	flag.BoolVar(&c.ListModels, "list-models", false, "Gemini 모델 조회 후 종료")
	flag.Parse()
	if c.Interval < time.Minute || c.Days < 0 || c.Max < 1 || c.Max > 20 || c.Candidates < c.Max || c.Candidates > 100 {
		return errors.New("옵션 확인: interval >= 1m, days >= 0, 1 <= max-papers <= 20, max-papers <= candidates <= 100")
	}
	if c.Topic != "" && c.TopicFile != "" {
		return errors.New("-topic과 -topic-file 중 하나만 사용하세요")
	}
	if _, err := sourceNames(c.Sources); err != nil {
		return err
	}
	input := bufio.NewReader(os.Stdin)
	key := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if key == "" {
		fmt.Print("AI Studio API 키 (화면에 표시됨; 숨기려면 GEMINI_API_KEY 환경변수 사용): ")
		line, err := input.ReadString('\n')
		if err != nil && strings.TrimSpace(line) == "" {
			return errors.New("GEMINI_API_KEY를 설정하거나 API 키를 입력하세요")
		}
		key = strings.TrimSpace(line)
	}
	if key == "" {
		return errors.New("API 키가 비어 있습니다")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	a := &App{Config: c, API: &API{Client: &http.Client{Timeout: 120 * time.Second}, Key: key,
		GeminiURL: "https://generativelanguage.googleapis.com/v1beta", ArxivURL: "https://export.arxiv.org/api/query",
		PMCURL: "https://www.ebi.ac.uk/europepmc/webservices/rest/search", RetryDelay: 3 * time.Second}}
	if c.ListModels {
		models, err := a.API.models(ctx)
		if err != nil {
			return err
		}
		fmt.Println("generateContent 지원 Gemini 모델 (실제 호출 가능 여부는 권한/할당량에 따라 다름):")
		for _, m := range models {
			fmt.Printf("%s\t%s\n", m.Name, m.DisplayName)
		}
		return nil
	}
	if c.Topic == "" && c.TopicFile == "" {
		fmt.Print("관심 있는 연구 주제를 문장으로 입력하세요: ")
		line, _ := input.ReadString('\n')
		a.Config.Topic = strings.TrimSpace(line)
	}
	if _, err := a.topic(); err != nil {
		return err
	}
	if err := os.MkdirAll(c.Out, 0700); err != nil {
		return err
	}
	// A single owner prevents concurrent writers from corrupting deduplication state.
	lockPath := c.Out + string(os.PathSeparator) + ".running.lock"
	lock, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("실행 잠금 생성 실패: %w (다른 실행이 없다면 .running.lock 삭제)", err)
	}
	fmt.Fprintf(lock, "pid=%d\n", os.Getpid())
	lock.Close()
	defer os.Remove(lockPath)
	// Runs are serialized. Missed ticks are coalesced; no catch-up burst.
	ticker := time.NewTicker(c.Interval)
	defer ticker.Stop()
	for {
		runCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
		path, err := a.cycle(runCtx)
		cancel()
		if ctx.Err() != nil {
			return nil
		}
		if err != nil {
			if c.Once {
				return err
			}
			log.Printf("실행 실패: %v. 다음 주기에 재시도합니다.", err)
		} else {
			log.Printf("보고서 저장: %s", path)
		}
		if c.Once {
			return nil
		}
		log.Printf("%s 간격으로 실행 중. 종료: Ctrl+C", c.Interval)
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
