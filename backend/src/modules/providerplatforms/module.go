// Package providerplatforms is the Provider Platforms feature module: LMS connections (Canvas, Brightspace, Kolibri), their users and courses.
// Its code moves here from core in EN-193.
package providerplatforms

import (
	"embed"
	"io/fs"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
)

//go:embed migrations
var migrations embed.FS

// Module is the Provider Platforms module.
type Module struct{}

var _ module.Module = Module{}

func (Module) Name() string { return "providerplatforms" }

func (Module) Register(module.Router, module.Deps) {}

func (Module) RegisterJobs(module.Scheduler, module.Deps) {}

func (Module) Migrations() fs.FS { return migrations }
