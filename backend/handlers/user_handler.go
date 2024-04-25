package handlers

import (
	"backend/models"
	"net/http"
)

func (s *Server) IndexUsers(w http.ResponseWriter, r *http.Request) {
	users := models.User{}
	stmt := "SELECT * FROM users"
	s.Db.Query(stmt, &users)
}
