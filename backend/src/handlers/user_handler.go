package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleIndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowUser)))
	srv.Mux.Handle("GET /api/users/{id}/dashboard", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserDashboard)))
	srv.Mux.Handle("POST /api/users", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateUser)))
	srv.Mux.Handle("POST /api/users/student-password", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleResetStudentPassword)))
}

/**
* GET: /api/users
**/
func (srv *Server) HandleIndexUsers(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage)
	if err != nil {
		log.Error("IndexUsers Database Error: ", err)
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
func (srv *Server) HandleShowUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("GET User nandler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !srv.UserIsAdmin(r) && !srv.UserIsOwner(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	response := models.Resource[models.User]{}
	user := srv.Db.GetUserByID(uint(id))
	if user == nil {
		log.Info("Error: ", err)
		http.Error(w, "User not found", http.StatusNotFound)
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
func (srv *Server) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	user := models.User{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		log.Info("POST User handler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newUser, err := srv.Db.CreateUser(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Info("New user created, temp password: " + user.Password)
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
func (srv *Server) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("DELETE User handler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err = srv.Db.DeleteUser(id); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
	w.WriteHeader(http.StatusNoContent)
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("UPDATE User handler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	toUpdate := srv.Db.GetUserByID(uint(id))
	if toUpdate == nil {
		log.Error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		srv.ErrorResponse(w, http.StatusNotFound, "user not found")
		return
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

type TempPasswordRequest struct {
	UserID uint `json:"user_id"`
}

func (srv *Server) HandleResetStudentPassword(w http.ResponseWriter, r *http.Request) {
	temp := TempPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		log.Error("Parsing form failed, using JSON", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	defer r.Body.Close()
	response := make(map[string]string)
	newPass, err := srv.Db.AssignTempPasswordToUser(uint(temp.UserID))
	if err != nil {
		response["message"] = err.Error()
		err = srv.WriteResponse(w, http.StatusInternalServerError, response)
		if err != nil {
			log.Error("Error writing response: ", err.Error())
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	response["temp_password"] = newPass
	response["message"] = "Temporary password assigned"
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Error("Error writing response: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) HandleUserDashboard(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	userDashboard, err := srv.Db.GetUserDashboardInfo(userId)
	if err != nil {
		log.Errorf("Error getting user dashboard info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := models.Resource[models.UserDashboardJoin]{Message: "successfully retrieved users dashboard info"}
	response.Data = append(response.Data, userDashboard)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Errorf("user dashboard endpoint: error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
