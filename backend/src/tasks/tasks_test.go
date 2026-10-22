package tasks

import (
	"context"
	"io/fs"
	"slices"
	"testing"
	"testing/fstest"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
)

func TestServerRunsJobs(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{value: "", want: true},
		{value: "true", want: true},
		{value: "false", want: false},
		{value: "0", want: false},
		{value: "not-a-bool", want: true},
	}
	for _, tt := range tests {
		t.Run("RUN_SCHEDULER="+tt.value, func(t *testing.T) {
			t.Setenv("RUN_SCHEDULER", tt.value)
			if got := ServerRunsJobs(); got != tt.want {
				t.Errorf("ServerRunsJobs() = %v, want %v", got, tt.want)
			}
		})
	}
}

// jobModule is a feature module that registers one job.
type jobModule struct {
	deps *module.Deps
}

func (jobModule) Name() string                        { return "jobmodule" }
func (jobModule) Register(module.Router, module.Deps) {}
func (jobModule) Migrations() fs.FS                   { return fstest.MapFS{} }

func (m jobModule) RegisterJobs(s module.Scheduler, deps module.Deps) {
	*m.deps = deps
	if err := s.Cron("0 3 * * *", func() {}); err != nil {
		panic(err)
	}
}

func TestStart(t *testing.T) {
	t.Setenv("MIDDLEWARE_CRON_SCHEDULE", "0 22 * * *")
	db := database.InitDB(context.Background(), true)

	var got module.Deps
	// dev skips the run-everything-at-start, which needs NATS.
	s := Start(true, nil, db.DB, []module.Module{jobModule{deps: &got}})
	t.Cleanup(func() { _ = s.Shutdown() })

	if got.DB != db.DB {
		t.Errorf("the module got DB %p, want the scheduler's %p", got.DB, db.DB)
	}

	// The test database enables Kiwix and YouTube and no LMS providers, so
	// core schedules the class-activation job and the three content jobs, plus
	// dev's one-off Kiwix scrape; the module adds its own job.
	var names []string
	if err := db.Model(&models.CronJob{}).Pluck("name", &names).Error; err != nil {
		t.Fatal(err)
	}
	slices.Sort(names)
	wantNames := []string{
		string(models.ActivateScheduledClassesJob),
		string(models.RetryVideoDownloadsJob),
		string(models.ScrapeKiwixJob),
		string(models.SyncVideoMetadataJob),
	}
	slices.Sort(wantNames)
	if !slices.Equal(names, wantNames) {
		t.Errorf("cron jobs = %v, want %v", names, wantNames)
	}
	if n := len(s.Jobs()); n != len(wantNames)+2 {
		t.Errorf("scheduled %d jobs, want %d (core's %d, dev's one-off scrape, the module's)", n, len(wantNames)+2, len(wantNames))
	}
}
