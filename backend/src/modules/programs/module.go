// Package programs is the Programs feature module: programs, classes, enrollments, events and attendance.
// Its code moves here from core in EN-194.
package programs

import (
	"embed"
	"io/fs"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/nats-io/nats.go"
)

//go:embed migrations
var migrations embed.FS

// Module is the Programs module.
type Module struct{}

var _ module.Module = Module{}

func (Module) Name() string { return "programs" }

func (Module) Register(module.Router, module.Deps) {}

func (Module) RegisterJobs(module.Scheduler, *nats.Conn) {}

func (Module) Migrations() fs.FS { return migrations }
