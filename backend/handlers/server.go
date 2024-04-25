package handlers

import (
	db "backend/database"
	"log"
	"math"
	"net/http"
	"strconv"
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

func (s *Server) GetPaginationInfo(r *http.Request) (int, int) {
	page := r.URL.Query().Get("page")
	perPage := r.URL.Query().Get("per_page")
	if page == "" {
		page = "1"
	}
	if perPage == "" {
		perPage = "10"
	}
	intPage, err := strconv.Atoi(page)
	if err != nil {
		intPage = 1
	}
	intPerPage, err := strconv.Atoi(perPage)
	if err != nil {
		intPerPage = 10
	}
	return intPage, intPerPage
}

func (s *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
