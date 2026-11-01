package hub

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
)

const service = "CalendarHub.Local.v1"

// Vault is separate so tests never access the user's credential manager.
type Vault interface {
	Get(string) (*oauth2.Token, error)
	Set(string, *oauth2.Token) error
	Delete(string) error
}
type systemVault struct{}
type credentialHead struct {
	Generation string `json:"generation"`
	Parts      int    `json:"parts"`
}

func readHead(id string) (credentialHead, error) {
	s, e := keyring.Get(service, id)
	if e != nil {
		return credentialHead{}, e
	}
	var h credentialHead
	if e = json.Unmarshal([]byte(s), &h); e != nil {
		return h, e
	}
	if h.Parts < 1 || h.Parts > 128 || len(h.Generation) != 43 {
		return h, fmt.Errorf("invalid credential manifest")
	}
	return h, nil
}
func partID(id string, h credentialHead, i int) string {
	return fmt.Sprintf("%s:%s:%d", id, h.Generation, i)
}
func clearParts(id string, h credentialHead) error {
	var result error
	for i := 0; i < h.Parts; i++ {
		e := keyring.Delete(service, partID(id, h, i))
		if e != nil && !errors.Is(e, keyring.ErrNotFound) {
			result = errors.Join(result, e)
		}
	}
	return result
}

func (systemVault) Get(id string) (*oauth2.Token, error) {
	h, e := readHead(id)
	if e != nil {
		return nil, e
	}
	var t oauth2.Token
	var b strings.Builder
	for i := 0; i < h.Parts; i++ {
		s, e := keyring.Get(service, partID(id, h, i))
		if e != nil {
			return nil, e
		}
		b.WriteString(s)
	}
	e = json.Unmarshal([]byte(b.String()), &t)
	return &t, e
}
func (systemVault) Set(id string, t *oauth2.Token) error {
	b, e := json.Marshal(t)
	if e != nil {
		return e
	}
	// Windows limits each credential blob to 2560 bytes. Publish the new
	// manifest only after every chunk is stored, so refreshes are atomic.
	old, oldErr := readHead(id)
	if oldErr != nil && !errors.Is(oldErr, keyring.ErrNotFound) {
		return oldErr
	}
	h := credentialHead{random(), (len(b) + 1999) / 2000}
	if h.Parts > 128 {
		return fmt.Errorf("credential too large")
	}
	for i := 0; i < h.Parts; i++ {
		end := (i + 1) * 2000
		if end > len(b) {
			end = len(b)
		}
		if e = keyring.Set(service, partID(id, h, i), string(b[i*2000:end])); e != nil {
			_ = clearParts(id, h)
			return e
		}
	}
	head, _ := json.Marshal(h)
	if e = keyring.Set(service, id, string(head)); e != nil {
		_ = clearParts(id, h)
		return e
	}
	if oldErr == nil {
		_ = clearParts(id, old)
	}
	return nil
}
func (systemVault) Delete(id string) error {
	h, e := readHead(id)
	if errors.Is(e, keyring.ErrNotFound) {
		return nil
	}
	if e != nil {
		return e
	}
	if e = clearParts(id, h); e != nil {
		return e
	}
	e = keyring.Delete(service, id)
	if errors.Is(e, keyring.ErrNotFound) {
		return nil
	}
	return e
}

func loadAccounts(path string) ([]Account, error) {
	b, e := os.ReadFile(path)
	if os.IsNotExist(e) {
		return []Account{}, nil
	}
	if e != nil {
		return nil, e
	}
	var a []Account
	if e = json.Unmarshal(b, &a); e != nil {
		return nil, fmt.Errorf("accounts metadata: %w", e)
	}
	return a, nil
}
func saveAccounts(path string, a []Account) error {
	if e := os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		return e
	}
	b, e := json.MarshalIndent(a, "", "  ")
	if e != nil {
		return e
	}
	// Same-directory replace prevents partially written JSON after interruption.
	f, e := os.CreateTemp(filepath.Dir(path), "accounts-*.tmp")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(b); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	return os.Rename(name, path)
}
