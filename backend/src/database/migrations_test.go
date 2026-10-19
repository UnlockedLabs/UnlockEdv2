package database

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/glebarez/go-sqlite"
)

func TestCoreMigrationsPending(t *testing.T) {
	tests := []struct {
		name    string
		applied []int64 // versions the ledger records; nil means no ledger table
		want    bool
		wantErr bool
	}{
		{name: "nothing pending at the latest version", applied: []int64{1, 2}, want: false},
		{name: "pending while the database is behind", applied: []int64{1}, want: true},
		{name: "no ledger yet is an error, not a new ledger", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range []string{"00001_first.sql", "00002_second.sql"} {
				body := "-- +goose Up\nSELECT 1;\n-- +goose Down\nSELECT 1;\n"
				if err := os.WriteFile(filepath.Join(dir, f), []byte(body), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			t.Setenv("MIGRATION_DIR", dir)

			db, err := sql.Open("sqlite", "file::memory:")
			if err != nil {
				t.Fatal(err)
			}
			db.SetMaxOpenConns(1)
			t.Cleanup(func() { _ = db.Close() })
			if tt.applied != nil {
				if _, err := db.Exec(`CREATE TABLE goose_db_version (version_id INTEGER, is_applied BOOLEAN)`); err != nil {
					t.Fatal(err)
				}
				for _, v := range tt.applied {
					if _, err := db.Exec(`INSERT INTO goose_db_version VALUES (?, true)`, v); err != nil {
						t.Fatal(err)
					}
				}
			}

			got, err := CoreMigrationsPending(context.Background(), db)
			if (err != nil) != tt.wantErr {
				t.Fatalf("CoreMigrationsPending() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("CoreMigrationsPending() = %v, want %v", got, tt.want)
			}
			var tables int
			if err := db.QueryRow(`SELECT count(*) FROM sqlite_master WHERE name = 'goose_db_version'`).Scan(&tables); err != nil {
				t.Fatal(err)
			}
			if tt.applied == nil && tables != 0 {
				t.Error("CoreMigrationsPending created the ledger")
			}
		})
	}
}
