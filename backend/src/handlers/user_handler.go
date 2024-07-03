package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleIndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowUser)))
	srv.Mux.Handle("POST /api/users", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleCreateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateUser)))
	srv.Mux.Handle("POST /api/users/student-password", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleResetStudentPassword)))
}

/**
* GET: /api/users
**/
func (srv *Server) HandleIndexUsers(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	// TODO: impl search
	include := r.URL.Query()["include"]
	if slices.Contains(include, "logins") {
		srv.HandleGetUsersWithLogins(w, r.WithContext(r.Context()))
		return
	}
	if slices.Contains(include, "only_unmapped") {
		providerId := r.URL.Query().Get("provider_id")
		srv.HandleGetUnmappedUsers(w, r, providerId)
		return
	}
	facilityId := srv.getFacilityID(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage, facilityId)
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

func (srv *Server) HandleGetUnmappedUsers(w http.ResponseWriter, r *http.Request, providerId string) {
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query()["search"]
	total, users, err := srv.Db.GetUnmappedUsers(page, perPage, providerId, search, facilityId)
	if err != nil {
		log.Error("Database Error getting unmapped users: ", err)
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
	log.Println("users: ", users)
	response := models.PaginatedResource[models.User]{
		Data:    users,
		Meta:    paginationData,
		Message: "unmapped users returned successfully",
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Errorln("Error writing response: ", err)
		return
	}
}

func (srv *Server) HandleGetUsersWithLogins(w http.ResponseWriter, r *http.Request) {
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetUsersWithLogins(page, perPage, facilityId)
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
	response := models.PaginatedResource[database.UserWithLogins]{Data: users, Meta: paginationData, Message: "users with mappings returned successfully"}
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
		log.Error("GET User handler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !srv.canViewUserData(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	response := models.Resource[models.User]{}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		log.Info("Error: ", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	response.Data = append(response.Data, *user)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "error writing response")
	}
}

type NewUserResponse struct {
	TempPassword string      `json:"temp_password"`
	User         models.User `json:"user"`
}

type CreateUserRequest struct {
	User      models.User `json:"user"`
	Providers []int       `json:"provider_platforms"`
}

/**
* POST: /api/users
**/
func (srv *Server) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	user := CreateUserRequest{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		log.Info("POST User handler Error: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if user.User.FacilityID == 0 {
		user.User.FacilityID = srv.getFacilityID(r)
	}
	newUser, err := srv.Db.CreateUser(&user.User)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for _, providerID := range user.Providers {
		provider, err := srv.Db.GetProviderPlatformByID(providerID)
		if err != nil {
			log.Error("Error getting provider platform by id createProviderUserAccount")
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err = srv.createAndRegisterProviderUserAccount(provider, newUser); err != nil {
			log.Error("Error creating provider user account for provider: ", provider.Name)
		}
	}
	response := NewUserResponse{
		User:         *newUser,
		TempPassword: newUser.Password,
	}
	// if we aren't in a testing environment, register the user as an Identity with Kratos
	if !srv.isTesting(r) {
		if err := srv.handleCreateUserKratos(newUser.Username, newUser.Password); err != nil {
			log.Printf("Error creating user in kratos: %v", err)
		}
	}
	if err := srv.WriteResponse(w, http.StatusCreated, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		log.WithField("user_id", id).Error("unable to find user to be deleted")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
	if err := srv.deleteIdentityInKratos(&user.KratosID); err != nil {
		log.WithField("user_id", id).Error("error deleting user in kratos")
		srv.ErrorResponse(w, http.StatusInternalServerError, "error deleting user in kratos")
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
	toUpdate, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
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
	user, err := srv.Db.GetUserByID(uint(temp.UserID))
	if err != nil {
		log.Errorf("Exising user not found, this should never happen: %v", temp.UserID)
		http.Error(w, "internal server error: existing user not found", http.StatusInternalServerError)
		return
	}
	if user.KratosID == "" {
		err := srv.handleCreateUserKratos(user.Username, newPass)
		if err != nil {
			log.Errorf("Error creating user in kratos: %v", err)
			http.Error(w, "internal server error: error creating user in kratos", http.StatusInternalServerError)
			return
		}
	} else {
		if err := srv.handleUpdatePasswordKratos(user, newPass); err != nil {
			log.Error("Error updating password for new kratos user")
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Error("Error writing response: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
