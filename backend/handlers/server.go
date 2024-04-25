package handlers

import (
	db "backend/database"
	"log"
)

type Server struct {
	Db     *db.DB
	Logger *log.Logger
}

func NewServer(db *db.DB, logger *log.Logger) *Server {
	s := &Server{
		Db:     db,
		Logger: logger,
	}
	return s
}
