// Package module is the seam between core and the feature modules in
// src/modules. A feature module may import this package, other modules' api
// packages and unlocked-contracts, and nothing else from core; depguard in
// backend/.golangci.yml enforces it.
package module

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"slices"

	"github.com/UnlockedLabs/unlocked-contracts/features"

	"github.com/nats-io/nats.go"
	"github.com/pressly/goose/v3"
	"gorm.io/gorm"
)

// Module is one feature. Core calls Register and RegisterJobs once at startup
// and runs the module's migrations after its own.
type Module interface {
	// Name is the module's folder name. It also names the module's migration
	// ledger, so it never changes.
	Name() string
	Register(r Router, deps Deps)
	RegisterJobs(s Scheduler, deps Deps)
	// Migrations holds the module's goose .sql files in a "migrations" folder.
	Migrations() fs.FS
}

// Route is one HTTP route, such as "GET /api/libraries". The module writes
// its own responses and errors (EN-188: handler helpers stay in each module).
type Route struct {
	Pattern string
	Handler http.Handler
	// Access is who may call the route. The zero value is AnyUser.
	Access AccessLevel
	// Features turns the route off unless every listed feature is enabled.
	Features []features.Access
}

// AccessLevel is who may call a route. Core enforces each level with the same
// checks as its own routes.
type AccessLevel int

const (
	// AnyUser is any logged-in user.
	AnyUser AccessLevel = iota
	// Admin is any admin: facility, department or system.
	Admin
	// DeptAdmin is department and system admins: the admins who can switch
	// facility.
	DeptAdmin
	// SystemAdmin is system admins only.
	SystemAdmin
)

// Router registers a module's routes behind core's auth, admin and
// feature-flag checks.
type Router interface {
	Handle(Route)
}

// Scheduler runs a module's background jobs.
type Scheduler interface {
	// Cron runs task on a standard five-field cron schedule.
	Cron(spec string, task func()) error
}

// Deps is what core shares with every module, for both its routes and its
// jobs.
type Deps struct {
	DB   *gorm.DB
	NATS *nats.Conn
}

const migrationsDir = "migrations"

// LedgerTable is the goose version table for a module's migrations. Each
// module has its own, so module versions never collide with core's
// (public.goose_db_version) or with each other's.
func LedgerTable(name string) string {
	return "goose_db_version_" + name
}

// Migrate runs each module's migrations, in order. Call it after core's
// migrations. A module with no migrations is skipped.
func Migrate(ctx context.Context, db *sql.DB, dialect goose.Dialect, mods []Module) error {
	for _, m := range mods {
		p, err := provider(db, dialect, m)
		if errors.Is(err, goose.ErrNoMigrations) {
			continue
		}
		if err != nil {
			return err
		}
		if _, err := p.Up(ctx); err != nil {
			return fmt.Errorf("migrate module %s: %w", m.Name(), err)
		}
	}
	return nil
}

// Reset rolls back every module's migrations, in reverse order. Call it
// before resetting core's, because module tables can reference core's.
func Reset(ctx context.Context, db *sql.DB, dialect goose.Dialect, mods []Module) error {
	for _, m := range slices.Backward(mods) {
		p, err := provider(db, dialect, m)
		if errors.Is(err, goose.ErrNoMigrations) {
			continue
		}
		if err != nil {
			return err
		}
		if _, err := p.DownTo(ctx, 0); err != nil {
			return fmt.Errorf("reset module %s: %w", m.Name(), err)
		}
	}
	return nil
}

func provider(db *sql.DB, dialect goose.Dialect, m Module) (*goose.Provider, error) {
	fsys, err := fs.Sub(m.Migrations(), migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("module %s migrations: %w", m.Name(), err)
	}
	p, err := goose.NewProvider(dialect, db, fsys,
		goose.WithTableName(LedgerTable(m.Name())),
		goose.WithDisableGlobalRegistry(true),
	)
	if err != nil && !errors.Is(err, goose.ErrNoMigrations) {
		return nil, fmt.Errorf("module %s migrations: %w", m.Name(), err)
	}
	return p, err
}
