package handlers

import (
	"backend/models"
	"encoding/json"
	"net/http"
	"strconv"
)

/**
* GET: /api/v1/users
**/
func (s *Server) IndexUsers(w http.ResponseWriter, r *http.Request) {
	s.Logger.Println("HIT: Index users")
	page, perPage := s.GetPaginationInfo(r)
	total, users, err := s.Db.GetCurrentUsers(page, perPage)
	if err != nil {
		s.Logger.Printf("IndexUsers Database Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	last := s.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	s.Logger.Printf("IndexUsers: %v", users)
	response := models.PaginatedResource[models.User]{
		Data: users,
		Meta: paginationData,
	}
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

/**
* GET: /api/v1/users/{id}
**/
func (s *Server) GetUserByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		s.Logger.Printf("GET User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	response := models.Resource[models.User]{}
	user, err := s.Db.GetUserByID(id)
	if err != nil {
		s.Logger.Printf("Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Data = append(response.Data, user)
	bytes, err := json.Marshal(response)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(bytes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

/**
* POST: /api/v1/users
**/
func (s *Server) CreateNewUser(w http.ResponseWriter, r *http.Request) {
	user := models.User{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		s.Logger.Printf("POST User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err = s.Db.CreateUser(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

/**
* DELETE: /api/v1/users/{id}
 */
func (s *Server) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		s.Logger.Printf("DELETE User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	user, err := s.Db.GetUserByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	user.IsDeleted = true
	_, err = s.Db.UpdateUser(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

/**
* PATCH: /api/v1/users/{id}
**/
func (s *Server) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		s.Logger.Printf("UPDATE User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user.ID = id
	updatedUser, err := s.Db.UpdateUser(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.User]{}
	response.Data = append(response.Data, updatedUser)
	bytes, err := json.Marshal(response)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(bytes)
	if err != nil {
		s.Logger.Printf("User handler: Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}
