package handlers

import "testing"

func TestVersionInfo(t *testing.T) {
	t.Run("falls back to unknown when env vars are unset", func(t *testing.T) {
		t.Setenv("APP_VERSION", "")
		t.Setenv("GIT_COMMIT", "")
		t.Setenv("GIT_BRANCH", "")

		got := versionInfo()
		want := versionResponse{Version: "unknown", Commit: "unknown", Branch: "unknown"}
		if got != want {
			t.Errorf("versionInfo() = %+v, want %+v", got, want)
		}
	})

	t.Run("reports env vars when set", func(t *testing.T) {
		t.Setenv("APP_VERSION", "1.2.3")
		t.Setenv("GIT_COMMIT", "abc1234")
		t.Setenv("GIT_BRANCH", "main")

		got := versionInfo()
		want := versionResponse{Version: "1.2.3", Commit: "abc1234", Branch: "main"}
		if got != want {
			t.Errorf("versionInfo() = %+v, want %+v", got, want)
		}
	})
}
