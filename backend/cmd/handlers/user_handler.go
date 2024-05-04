package handlers

import (
	"Go-Prototype/backend/cmd/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.applyMiddleware(http.HandlerFunc(srv.handleIndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleShowUser)))
	srv.Mux.Handle("POST /api/users", srv.applyMiddleware(http.HandlerFunc(srv.handleCreateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleDeleteUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleUpdateUser)))
}

/**
* GET: /api/users
**/
func (srv *Server) handleIndexUsers(w http.ResponseWriter, r *http.Request) {
	if !srv.UserIsAdmin(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage)
	if err != nil {
		srv.Logger.Error("IndexUsers Database Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	srv.Logger.Info("IndexUsers: %v", users)
	response := models.PaginatedResource[models.User]{
		Data: users,
		Meta: paginationData,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

/**
* GET: /api/users/{id}
**/
func (srv *Server) handleShowUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Error("GET User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if !srv.UserIsAdmin(r) && !srv.UserIsOwner(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	response := models.Resource[models.User]{}
	user := srv.Db.GetUserByID(uint(id))
	if user == nil {
		srv.Logger.Info("Error: %v", err)
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	response.Data = append(response.Data, *user)
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

type NewUserResponse struct {
	TempPassword string      `json:"temp_password"`
	User         models.User `json:"user"`
}

/**
* POST: /api/users
**/
func (srv *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	user := models.User{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		srv.Logger.Info("POST User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newUser, err := srv.Db.CreateUser(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	srv.LogInfo("New user created, temp password: " + user.Password)
	if newUser == nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error creating user")
	} else {
		response := NewUserResponse{
			User:         *newUser,
			TempPassword: newUser.Password,
		}
		if err := srv.WriteResponse(w, http.StatusCreated, response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Error("DELETE User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.DeleteUser(id); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
	w.WriteHeader(http.StatusNoContent)
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Error("UPDATE User handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	toUpdate := srv.Db.GetUserByID(uint(id))
	if toUpdate == nil {
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		srv.LogError("Error getting user by ID:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &user)

	updatedUser, err := srv.Db.UpdateUser(toUpdate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.User]{}
	response.Data = append(response.Data, *updatedUser)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
