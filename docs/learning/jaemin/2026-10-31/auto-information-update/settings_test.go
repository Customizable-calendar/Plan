package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPreferencesRoundTripAndValidation(t *testing.T) {
	base := t.TempDir()
	path := filepath.Join(base, "settings.json")
	p, err := readPreferences(path, base)
	if err != nil {
		t.Fatal(err)
	}
	p.Topic = "한국어 관심 문장"
	p.Model = "models/gemini-test"
	if err := savePreferences(path, p); err != nil {
		t.Fatal(err)
	}
	got, err := readPreferences(path, base)
	if err != nil || got != p {
		t.Fatal(got, err)
	}
	b, _ := os.ReadFile(path)
	if strings.Contains(strings.ToLower(string(b)), "api_key") {
		t.Fatal("credential field persisted")
	}
	p.Candidates = p.MaxPapers - 1
	if savePreferences(path, p) == nil {
		t.Fatal("invalid counts accepted")
	}
	if err := os.WriteFile(path, []byte("corrupt"), 0600); err != nil {
		t.Fatal(err)
	}
	got, err = readPreferences(path, base)
	if err == nil || got != defaultPreferences(base) {
		t.Fatal("corrupt settings not recovered")
	}
}

func TestRunLockOwnershipAndRelease(t *testing.T) {
	out := filepath.Join(t.TempDir(), "reports")
	release, err := acquireRunLock(out)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := acquireRunLock(out); err == nil {
		t.Fatal("concurrent writer accepted")
	}
	release()
	release, err = acquireRunLock(out)
	if err != nil {
		t.Fatal(err)
	}
	release()
}
