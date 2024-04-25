package handlers

import (
	"backend/models"
	"encoding/json"
	"net/http"
)

func (s *Server) IndexUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.Db.GetCurrentUsers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.ResponseResource[models.User]{}
	response.Data = users
	response.Message = "Users fetched successfully"
	bytes, err := json.Marshal(response)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(bytes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}
