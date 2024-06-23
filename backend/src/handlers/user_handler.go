package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleIndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowUser)))
	srv.Mux.Handle("POST /api/users", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateUser)))
	srv.Mux.Handle("POST /api/users/student-password", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleResetStudentPassword)))
}

/**
* GET: /api/users
**/
func (srv *Server) HandleIndexUsers(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleIndexUsers",
		"route":   "GET /api/users",
	}
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage)
	if err != nil {
		logFields["databaseMethod"] = "GetCurrentUsers"
		log.WithFields(logFields).Errorf("Error fetching users: %v", err)
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
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

/**
* GET: /api/users/{id}
**/
func (srv *Server) HandleShowUser(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleShowUser",
		"route":   "GET /api/users/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["id"] = id
	if !srv.canViewUserData(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	response := models.Resource[models.User]{}
	user := srv.Db.GetUserByID(uint(id))
	if user == nil {
		logFields["databaseMethod"] = "GetUserByID"
		log.WithFields(logFields).Warn("No user found with provided ID.")
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	response.Data = append(response.Data, *user)
	bytes, err := json.Marshal(response)
	if err != nil {
		log.WithFields(logFields).Errorf("Error marshalling response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(bytes)
	if err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
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
	logFields := log.Fields{
		"handler": "HandleCreateUser",
		"route":   "POST /api/users",
	}
	user := models.User{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newUser, err := srv.Db.CreateUser(&user)
	if err != nil {
		logFields["databaseMethod"] = "CreateUser"
		log.WithFields(logFields).Errorf("Error creating user: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Infof("New user created, temp password: %v", user.Password)
	if newUser == nil {
		log.WithFields(logFields).Warn("No user found with provided ID.")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error creating user")
	} else {
		response := NewUserResponse{
			User:         *newUser,
			TempPassword: newUser.Password,
		}
		// if we aren't in a testing environment, register the user as an Identity with Kratos
		if !srv.isTesting(r) {
			if err := srv.handleCreateUserKratos(newUser.Username, newUser.Password); err != nil {
				log.Warnf("Error creating user in kratos: %v", err)
			}
		}
		if err := srv.WriteResponse(w, http.StatusCreated, response); err != nil {
			log.WithFields(logFields).Errorf("Error writing response: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleDeleteUser",
		"route":   "DELETE /api/users/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["id"] = id
	if err = srv.Db.DeleteUser(id); err != nil {
		logFields["databaseMethod"] = "DeleteUser"
		log.WithFields(logFields).Errorf("Error deleting user: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
	w.WriteHeader(http.StatusNoContent)
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUpdateUser",
		"route":   "PATCH /api/users/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["id"] = id
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	toUpdate := srv.Db.GetUserByID(uint(id))
	if toUpdate == nil {
		logFields["databaseMethod"] = "GetUserByID"
		log.Errorf("Error getting user by ID: %v", id)
		srv.ErrorResponse(w, http.StatusNotFound, "user not found")
		return
	}
	models.UpdateStruct(&toUpdate, &user)

	updatedUser, err := srv.Db.UpdateUser(toUpdate)
	if err != nil {
		logFields["databaseMethod"] = "UpdateUser"
		log.WithFields(logFields).Errorf("Error updating user: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.User]{}
	response.Data = append(response.Data, *updatedUser)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type TempPasswordRequest struct {
	UserID uint `json:"user_id"`
}

func (srv *Server) HandleResetStudentPassword(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleResetStudentPassword",
		"route":   "POST /api/users/student-password",
	}
	temp := TempPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["user_id"] = temp.UserID
	defer r.Body.Close()
	response := make(map[string]string)
	newPass, err := srv.Db.AssignTempPasswordToUser(uint(temp.UserID))
	if err != nil {
		logFields["databaseMethod"] = "AssignTempPasswordToUser"
		log.WithFields(logFields).Errorf("Error assigning temporary password: %v", err)
		response["message"] = err.Error()
		err = srv.WriteResponse(w, http.StatusInternalServerError, response)
		if err != nil {
			log.WithFields(logFields).Errorf("Error writing response: %v", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	response["temp_password"] = newPass
	response["message"] = "Temporary password assigned"
	user := srv.Db.GetUserByID(uint(temp.UserID))
	if user == nil {
		logFields["databaseMethod"] = "GetUserByID"
		log.WithFields(logFields).Error("Exising user not found, this should never happen.")
		http.Error(w, "internal server error: existing user not found", http.StatusInternalServerError)
		return
	}
	logFields["kratosId"] = user.KratosID
	if user.KratosID == "" {
		err := srv.handleCreateUserKratos(user.Username, newPass)
		if err != nil {
			log.WithFields(logFields).Errorf("Error creating user in kratos: %v", err)
			http.Error(w, "internal server error: error creating user in kratos", http.StatusInternalServerError)
			return
		}
	} else {
		if err := srv.handleUpdatePasswordKratos(user, newPass); err != nil {
			log.WithFields(logFields).Errorf("Error updating password for new kratos user: %v", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
			log.WithFields(logFields).Errorf("Error writing response: %v", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
}
