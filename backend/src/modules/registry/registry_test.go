package registry_test

import (
	"context"
	"database/sql"
	"io/fs"
	"testing"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/registry"

	_ "github.com/glebarez/go-sqlite"
	"github.com/pressly/goose/v3"
)

func TestAllModules(t *testing.T) {
	seen := map[string]bool{}
	for _, m := range registry.All() {
		name := m.Name()
		if seen[name] {
			t.Errorf("module %q registered twice", name)
		}
		seen[name] = true
		if _, err := fs.Stat(m.Migrations(), "migrations"); err != nil {
			t.Errorf("module %q has no migrations folder: %v", name, err)
		}
	}
	if len(seen) != 4 {
		t.Errorf("got %d modules, want 4 (EN-186)", len(seen))
	}
}

func TestAllModulesMigrate(t *testing.T) {
	db, err := sql.Open("sqlite", "file::memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := module.Migrate(context.Background(), db, goose.DialectSQLite3, registry.All()); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
}
