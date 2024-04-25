package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	Db *sql.DB
}

func InitDB(isTesting bool) *DB {
	if isTesting {
		database, err := sql.Open("sqlite3", "file::memory:?cache=shared")
		if err != nil {
			log.Fatal(err)
		}
		defer database.Close()
		log.Printf("Connected to the database %v", database.Stats())
		return &DB{Db: database}

	} else {
		database, err := sql.Open("postgres", fmt.Sprintf("host=%s port=%s user=%s "+
			"password=%s dbname=%s sslmode=disable",
			os.Getenv("DB_HOST"),
			os.Getenv("DB_PORT"),
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_NAME"),
		))
		if err != nil {
			log.Fatalf("Error opening database: %v", err)
		}
		defer database.Close()
		log.Printf("Connected to the database %v", database.Stats())

		return &DB{Db: database}
	}
}
