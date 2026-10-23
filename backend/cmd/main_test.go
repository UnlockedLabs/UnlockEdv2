package main

import (
	"context"
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
)

// plainModule is a feature module without a worker.
type plainModule struct{ name string }

func (m plainModule) Name() string                             { return m.name }
func (plainModule) Register(module.Router, module.Deps)        {}
func (plainModule) RegisterJobs(module.Scheduler, module.Deps) {}
func (plainModule) Migrations() fs.FS                          { return fstest.MapFS{} }

// workerModule is a feature module with a worker.
type workerModule struct{ plainModule }

func (workerModule) Work(context.Context, module.Deps) error { return nil }

func TestFindWorker(t *testing.T) {
	worker := workerModule{plainModule{"withworker"}}
	mods := []module.Module{plainModule{"plain"}, worker}
	tests := []struct {
		name    string
		want    module.Worker
		wantErr string
	}{
		{name: "withworker", want: worker},
		{name: "plain", wantErr: `module "plain" has no worker`},
		{name: "missing", wantErr: `no module named "missing"`},
		{name: "", wantErr: `no module named ""`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := findWorker(mods, tt.name)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Fatalf("findWorker(%q) error = %v, want %q", tt.name, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("findWorker(%q): %v", tt.name, err)
			}
			if got != tt.want {
				t.Errorf("findWorker(%q) = %v, want %v", tt.name, got, tt.want)
			}
		})
	}
}
