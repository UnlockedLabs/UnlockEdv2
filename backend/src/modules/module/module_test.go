package module_test

import (
	"context"
	"database/sql"
	"io/fs"
	"slices"
	"testing"
	"testing/fstest"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	_ "github.com/glebarez/go-sqlite"
	"github.com/pressly/goose/v3"
)

type fakeModule struct {
	name  string
	files fstest.MapFS
}

func (m fakeModule) Name() string                               { return m.name }
func (m fakeModule) Register(module.Router, module.Deps)        {}
func (m fakeModule) RegisterJobs(module.Scheduler, module.Deps) {}
func (m fakeModule) Migrations() fs.FS                          { return m.files }

func migration(up, down string) *fstest.MapFile {
	return &fstest.MapFile{Data: []byte("-- +goose Up\n" + up + "\n-- +goose Down\n" + down + "\n")}
}

// beta copies a row from alpha's table, so it only migrates after alpha. Its
// row references alpha's, so alpha only rolls back after beta.
var (
	alpha = fakeModule{name: "alpha", files: fstest.MapFS{
		"migrations/00001_create_alpha.sql": migration(
			"CREATE TABLE alpha_items (id INTEGER PRIMARY KEY);\nINSERT INTO alpha_items (id) VALUES (1);",
			"DROP TABLE alpha_items;"),
	}}
	beta = fakeModule{name: "beta", files: fstest.MapFS{
		"migrations/00001_create_beta.sql": migration(
			"CREATE TABLE beta_items (id INTEGER PRIMARY KEY, alpha_id INTEGER NOT NULL REFERENCES alpha_items (id));\n"+
				"INSERT INTO beta_items (id, alpha_id) SELECT 1, id FROM alpha_items;",
			"DROP TABLE beta_items;"),
		"migrations/00002_add_beta_name.sql": migration(
			"ALTER TABLE beta_items ADD COLUMN name TEXT;", "ALTER TABLE beta_items DROP COLUMN name;"),
	}}
	empty = fakeModule{name: "empty", files: fstest.MapFS{
		"migrations/README.md": &fstest.MapFile{Data: []byte("no migrations yet")},
	}}
)

func openDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func tableExists(t *testing.T, db *sql.DB, name string) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n == 1
}

func latestVersion(t *testing.T, db *sql.DB, ledger string) int64 {
	t.Helper()
	var v int64
	if err := db.QueryRow(`SELECT max(version_id) FROM ` + ledger).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestMigrate(t *testing.T) {
	tests := []struct {
		name       string
		mods       []module.Module
		wantErr    bool
		wantTables []string
		wantLedger map[string]int64
		noLedger   []string
	}{
		{
			name:       "runs each module in order with its own ledger",
			mods:       []module.Module{alpha, beta},
			wantTables: []string{"alpha_items", "beta_items"},
			wantLedger: map[string]int64{"alpha": 1, "beta": 2},
		},
		{
			name:     "skips a module with no migrations",
			mods:     []module.Module{empty},
			noLedger: []string{"empty"},
		},
		{
			name:    "fails when a module runs before one it depends on",
			mods:    []module.Module{beta, alpha},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := openDB(t)
			err := module.Migrate(context.Background(), db, goose.DialectSQLite3, tt.mods)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Migrate() error = %v, wantErr %v", err, tt.wantErr)
			}
			for _, table := range tt.wantTables {
				if !tableExists(t, db, table) {
					t.Errorf("table %s missing", table)
				}
			}
			for name, want := range tt.wantLedger {
				if got := latestVersion(t, db, module.LedgerTable(name)); got != want {
					t.Errorf("%s ledger at version %d, want %d", name, got, want)
				}
			}
			for _, name := range tt.noLedger {
				if tableExists(t, db, module.LedgerTable(name)) {
					t.Errorf("ledger %s created for a module with no migrations", module.LedgerTable(name))
				}
			}
		})
	}
}

func TestMigrateTwiceIsANoOp(t *testing.T) {
	db := openDB(t)
	ctx := context.Background()
	mods := []module.Module{alpha, beta}
	for range 2 {
		if err := module.Migrate(ctx, db, goose.DialectSQLite3, mods); err != nil {
			t.Fatal(err)
		}
	}
	if got := latestVersion(t, db, module.LedgerTable("beta")); got != 2 {
		t.Errorf("beta ledger at version %d, want 2", got)
	}
}

func TestResetInForwardOrderFails(t *testing.T) {
	db := openDB(t)
	ctx := context.Background()
	if err := module.Migrate(ctx, db, goose.DialectSQLite3, []module.Module{alpha, beta}); err != nil {
		t.Fatal(err)
	}
	// Reset reverses the list it's given, so this rolls back alpha first, which
	// beta's row still references. It proves the order in Reset matters.
	if err := module.Reset(ctx, db, goose.DialectSQLite3, []module.Module{beta, alpha}); err == nil {
		t.Fatal("Reset() rolled back alpha while beta still referenced it")
	}
}

func TestResetRollsBackInReverseOrder(t *testing.T) {
	db := openDB(t)
	ctx := context.Background()
	mods := []module.Module{alpha, beta, empty}
	if err := module.Migrate(ctx, db, goose.DialectSQLite3, mods); err != nil {
		t.Fatal(err)
	}
	// beta references alpha, so this only succeeds if beta rolls back first.
	if err := module.Reset(ctx, db, goose.DialectSQLite3, mods); err != nil {
		t.Fatalf("Reset() error = %v", err)
	}
	for _, table := range []string{"alpha_items", "beta_items"} {
		if tableExists(t, db, table) {
			t.Errorf("table %s still exists after Reset", table)
		}
	}
}

func TestLedgerTable(t *testing.T) {
	if got := module.LedgerTable("programs"); got != "goose_db_version_programs" {
		t.Errorf("LedgerTable(programs) = %q", got)
	}
}

func TestPending(t *testing.T) {
	// betaV1 is beta before its second migration was added.
	betaV1 := fakeModule{name: "beta", files: fstest.MapFS{
		"migrations/00001_create_beta.sql": beta.files["migrations/00001_create_beta.sql"],
	}}
	tests := []struct {
		name     string
		migrated []module.Module // what has run
		check    []module.Module // what this image ships
		want     bool
		wantErr  bool
	}{
		{
			name:     "nothing pending once every module has migrated",
			migrated: []module.Module{alpha, beta},
			check:    []module.Module{alpha, beta, empty},
			want:     false,
		},
		{
			name:     "a migration added since the last run is pending",
			migrated: []module.Module{alpha, betaV1},
			check:    []module.Module{alpha, beta},
			want:     true,
		},
		{
			name:    "a module that has never migrated is an error, not a new ledger",
			check:   []module.Module{alpha},
			wantErr: true,
		},
		{
			name:  "a module with no migrations is skipped",
			check: []module.Module{empty},
			want:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := openDB(t)
			ctx := context.Background()
			if err := module.Migrate(ctx, db, goose.DialectSQLite3, tt.migrated); err != nil {
				t.Fatal(err)
			}
			got, err := module.Pending(ctx, db, goose.DialectSQLite3, tt.check)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Pending() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Pending() = %v, want %v", got, tt.want)
			}
			// Pending only reads: it never creates a ledger.
			for _, m := range tt.check {
				ran := slices.ContainsFunc(tt.migrated, func(x module.Module) bool { return x.Name() == m.Name() })
				if !ran && tableExists(t, db, module.LedgerTable(m.Name())) {
					t.Errorf("Pending created ledger %s", module.LedgerTable(m.Name()))
				}
			}
		})
	}
}

func TestAuditAction(t *testing.T) {
	var got []string
	ctx := module.WithAudit(context.Background(), func(action string) { got = append(got, action) })
	module.AuditAction(ctx, "video_featured")
	// Outside a module request there is no audit log, and nothing happens.
	module.AuditAction(context.Background(), "not_recorded")
	if !slices.Equal(got, []string{"video_featured"}) {
		t.Errorf("recorded %v, want [video_featured]", got)
	}
}
