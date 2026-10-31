package hub

import (
	"strings"
	"testing"
)

func TestGoogleDesktopImport(t *testing.T) {
	valid := []byte(`{"installed":{"client_id":"123-example.apps.googleusercontent.com","client_secret":"desktop-secret","auth_uri":"https://untrusted.invalid","token_uri":"https://untrusted.invalid"}}`)
	s, e := ParseGoogleDesktopJSON(valid)
	if e != nil || s.GoogleID != "123-example.apps.googleusercontent.com" || s.GoogleSecret != "desktop-secret" || s.MicrosoftID != "" {
		t.Fatalf("import: %v", e)
	}
	for _, b := range []string{`{"web":{"client_id":"123.apps.googleusercontent.com","client_secret":"secret"}}`, `{"type":"service_account","private_key":"do-not-import"}`, `invalid`, `{"installed":{"client_id":"bad","client_secret":"secret"}}`, `{"installed":{"client_id":"123.apps.googleusercontent.com"}}`, strings.Repeat("x", (1<<20)+1)} {
		if _, e := ParseGoogleDesktopJSON([]byte(b)); e == nil {
			t.Fatal("accepted non-desktop or incomplete JSON")
		}
	}
}
func TestProviderSetupValidation(t *testing.T) {
	s := Settings{GoogleID: "123.apps.googleusercontent.com", GoogleSecret: "secret", MicrosoftID: "12345678-1234-1234-1234-123456789abc"}
	for _, p := range []string{"google", "microsoft"} {
		if e := ValidateProviderSettings(p, s); e != nil {
			t.Fatal(e)
		}
		steps := SetupSteps(p)
		if len(steps) != 3 {
			t.Fatal("missing wizard steps")
		}
		for _, step := range steps {
			if step.Title == "" || step.Text == "" || !strings.HasPrefix(step.URL, "https://") {
				t.Fatal("incomplete setup step")
			}
		}
	}
	s.MicrosoftID = "tenant-id-or-placeholder"
	if ValidateProviderSettings("microsoft", s) == nil {
		t.Fatal("invalid Microsoft ID accepted")
	}
	if ValidateProviderSettings("other", s) == nil {
		t.Fatal("invalid provider accepted")
	}
}
