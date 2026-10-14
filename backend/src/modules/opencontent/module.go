// Package opencontent is the Open Content feature module: libraries (Kiwix), videos, helpful links and the content proxy.
// Its code moves here from core in EN-192.
package opencontent

import (
	"embed"
	"io/fs"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/nats-io/nats.go"
)

//go:embed migrations
var migrations embed.FS

// Module is the Open Content module.
type Module struct{}

var _ module.Module = Module{}

func (Module) Name() string { return "opencontent" }

func (Module) Register(module.Router, module.Deps) {}

func (Module) RegisterJobs(module.Scheduler, *nats.Conn) {}

func (Module) Migrations() fs.FS { return migrations }
