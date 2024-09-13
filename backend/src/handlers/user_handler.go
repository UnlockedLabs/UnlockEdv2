package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleIndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(srv.HandleError(srv.HandleShowUser)))
	srv.Mux.Handle("POST /api/users", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleCreateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleDeleteUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleUpdateUser)))
	srv.Mux.Handle("POST /api/users/student-password", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleResetStudentPassword)))
}

/**
* GET: /api/users
**/
func (srv *Server) HandleIndexUsers(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleIndexUsers")
	page, perPage := srv.GetPaginationInfo(r)
	include := r.URL.Query()["include"]
	if slices.Contains(include, "logins") {
		return srv.HandleGetUsersWithLogins(w, r.WithContext(r.Context()), fields)
	}
	if slices.Contains(include, "only_unmapped") {
		providerId := r.URL.Query().Get("provider_id")
		return srv.HandleGetUnmappedUsers(w, r, providerId, fields)
	}
	order := r.URL.Query().Get("order_by")
	search := strings.ToLower(r.URL.Query().Get("search"))
	search = strings.TrimSpace(search)
	facilityId := srv.getFacilityID(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage, facilityId, order, search)
	if err != nil {
		fields.add("facilityId", facilityId)
		fields.add("search", search)
		return newDatabaseServiceError(err)
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, users, paginationData)
}

func (srv *Server) HandleGetUnmappedUsers(w http.ResponseWriter, r *http.Request, providerId string, fields LogFields) error {
	fields.add("subhandlerCall", "HandleGetUnmappedUsers")
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query()["search"]
	total, users, err := srv.Db.GetUnmappedUsers(page, perPage, providerId, search, facilityId)
	if err != nil {
		fields.add("providerId", providerId)
		fields.add("facilityId", facilityId)
		return newDatabaseServiceError(err)
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, users, paginationData)
}

func (srv *Server) HandleGetUsersWithLogins(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("subhandlerCall", "HandleGetUsersWithLogins")
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetUsersWithLogins(page, perPage, facilityId)
	if err != nil {
		fields.add("facilityId", facilityId)
		return newDatabaseServiceError(err)
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, users, paginationData)
}

/**
* GET: /api/users/{id}
**/
func (srv *Server) HandleShowUser(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleShowUser")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	if !srv.canViewUserData(r) {
		return newUnauthorizedServiceError()
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		fields.add("userId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, user)
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
func (srv *Server) HandleCreateUser(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleCreateUser")
	user := CreateUserRequest{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if user.User.FacilityID == 0 {
		user.User.FacilityID = srv.getFacilityID(r)
	}
	userNameExists := srv.Db.UsernameExists(user.User.Username)
	if userNameExists {
		return newBadRequestServiceError(err, "userexists")
	}
	user.User.Username = removeChars(user.User.Username, disallowedChars)
	newUser, err := srv.Db.CreateUser(&user.User)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	for _, providerID := range user.Providers {
		provider, err := srv.Db.GetProviderPlatformByID(providerID)
		if err != nil {
			fields.add("providerID", providerID)
			fields.error("Error getting provider platform by id createProviderUserAccount")
			return newDatabaseServiceError(err)
		}
		if err = srv.createAndRegisterProviderUserAccount(provider, newUser); err != nil {
			fields.add("providerID", providerID)
			fields.error("Error creating provider user account for provider: ", provider.Name)
		}
	}
	tempPw := newUser.CreateTempPassword()
	response := NewUserResponse{
		User:         *newUser,
		TempPassword: tempPw,
	}
	// if we aren't in a testing environment, register the user as an Identity with Kratos + Kolibri
	if !srv.isTesting(r) {
		if err := srv.HandleCreateUserKratos(newUser.Username, tempPw); err != nil {
			log.Printf("Error creating user in kratos: %v", err)
		}
		kolibri, err := srv.Db.FindKolibriInstance()
		if err != nil {
			fields.error("error getting kolibri instance")
			// still return 201 because user has been created in kratos,
			// kolibri might not be set up/available
			return writeJsonResponse(w, http.StatusCreated, response)

		}
		if err := srv.CreateUserInKolibri(newUser, kolibri); err != nil {
			fields.add("userId", newUser.ID)
			fields.error("error creating user in kolibri")
		}
	}
	return writeJsonResponse(w, http.StatusCreated, response)
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) HandleDeleteUser(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleDeleteUser")
	id, err := strconv.Atoi(r.PathValue("id"))
	fields.add("userId", id)
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if err := srv.deleteIdentityInKratos(&user.KratosID); err != nil {
		fields.add("KratosID", user.KratosID)
		return newInternalServerServiceError(err, "error deleting user in kratos")
	}
	if err := srv.Db.DeleteUser(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "User deleted successfully")
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) HandleUpdateUser(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleUpdateUser")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		return newBadRequestServiceError(err, "invalid form data submited")
	}
	defer r.Body.Close()
	toUpdate, err := srv.Db.GetUserByID(uint(id))
	fields.add("userId", id)
	if err != nil {
		fields.error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		return newDatabaseServiceError(err)
	}
	if toUpdate.Username != user.Username && user.Username != "" {
		userNameExists := srv.Db.UsernameExists(user.Username)
		if userNameExists {
			return newBadRequestServiceError(err, "userexists")
		}
	}
	models.UpdateStruct(&toUpdate, &user)

	updatedUser, err := srv.Db.UpdateUser(toUpdate)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updatedUser)
}

type TempPasswordRequest struct {
	UserID uint `json:"user_id"`
}

func (srv *Server) HandleResetStudentPassword(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleResetStudentPassword")
	temp := TempPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	response := make(map[string]string)
	user, err := srv.Db.GetUserByID(uint(temp.UserID))
	fields.add("temp.UserID", temp.UserID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	newPass := user.CreateTempPassword()
	response["temp_password"] = newPass
	response["message"] = "Temporary password assigned"
	if user.KratosID == "" {
		err := srv.HandleCreateUserKratos(user.Username, newPass)
		if err != nil {
			return newInternalServerServiceError(err, "Error creating user in kratos")
		}
	} else {
		claims := claimsFromUser(user)
		claims.PasswordReset = true
		if err := srv.handleUpdatePasswordKratos(claims, newPass, true); err != nil {
			fields.add("claims.UserID", claims.UserID)
			return newInternalServerServiceError(err, err.Error())
		}
	}
	return writeJsonResponse(w, http.StatusOK, response)
}
