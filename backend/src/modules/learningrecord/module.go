// Package learningrecord is the Learning Record feature module: learning record entries.
// Its code moves here from core in EN-195.
package learningrecord

import (
	"embed"
	"io/fs"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/nats-io/nats.go"
)

//go:embed migrations
var migrations embed.FS

// Module is the Learning Record module.
type Module struct{}

var _ module.Module = Module{}

func (Module) Name() string { return "learningrecord" }

func (Module) Register(module.Router, module.Deps) {}

func (Module) RegisterJobs(module.Scheduler, *nats.Conn) {}

func (Module) Migrations() fs.FS { return migrations }
