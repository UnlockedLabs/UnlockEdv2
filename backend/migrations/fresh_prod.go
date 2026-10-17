//go:build !dev

// The default build (no -tags dev, including the shipped deploy image) gets
// this stub instead of fresh_dev.go's real implementation, so -fresh cannot
// drop tables, delete Kratos identities, or flush NATS no matter what
// environment variable someone sets at invocation time. See fresh_dev.go.

package main

import (
	"database/sql"
	"log"
)

func MigrateFresh(db *sql.DB) {
	log.Fatal("-fresh is not available in this build; rebuild with -tags dev to use it")
}
