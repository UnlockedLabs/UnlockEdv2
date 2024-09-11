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
func (srv *Server) HandleIndexUsers(w http.ResponseWriter, r *http.Request) error {
	page, perPage := srv.GetPaginationInfo(r)
	include := r.URL.Query()["include"]
	if slices.Contains(include, "logins") {
		return srv.HandleGetUsersWithLogins(w, r.WithContext(r.Context()))
	}
	if slices.Contains(include, "only_unmapped") {
		providerId := r.URL.Query().Get("provider_id")
		return srv.HandleGetUnmappedUsers(w, r, providerId)
	}
	order := r.URL.Query().Get("order_by")
	search := strings.ToLower(r.URL.Query().Get("search"))
	search = strings.TrimSpace(search)
	facilityId := srv.getFacilityID(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage, facilityId, order, search)
	if err != nil {
		return newDatabaseServiceError(err, nil)
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

func (srv *Server) HandleGetUnmappedUsers(w http.ResponseWriter, r *http.Request, providerId string) error {
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query()["search"]
	total, users, err := srv.Db.GetUnmappedUsers(page, perPage, providerId, search, facilityId)
	if err != nil {
		return newDatabaseServiceError(err, nil)
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

func (srv *Server) HandleGetUsersWithLogins(w http.ResponseWriter, r *http.Request) error {
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.GetPaginationInfo(r)
	total, users, err := srv.Db.GetUsersWithLogins(page, perPage, facilityId)
	if err != nil {
		return newDatabaseServiceError(err, nil)
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
func (srv *Server) HandleShowUser(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", nil)
	}
	if !srv.canViewUserData(r) {
		return newUnauthorizedServiceError(nil)
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err, nil)
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
func (srv *Server) HandleCreateUser(w http.ResponseWriter, r *http.Request) error {
	user := CreateUserRequest{}
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	defer r.Body.Close()
	if user.User.FacilityID == 0 {
		user.User.FacilityID = srv.getFacilityID(r)
	}
	userNameExists := srv.Db.UsernameExists(user.User.Username)
	if userNameExists {
		return newBadRequestServiceError(err, "userexists", nil)
	}
	user.User.Username = removeChars(user.User.Username, disallowedChars)
	newUser, err := srv.Db.CreateUser(&user.User)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	for _, providerID := range user.Providers {
		provider, err := srv.Db.GetProviderPlatformByID(providerID)
		if err != nil {
			log.Error("Error getting provider platform by id createProviderUserAccount")
			return newDatabaseServiceError(err, nil)
		}
		if err = srv.createAndRegisterProviderUserAccount(provider, newUser); err != nil {
			log.Error("Error creating provider user account for provider: ", provider.Name)
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
			log.Error("error getting kolibri instance")
			// still return 201 because user has been created in kratos,
			// kolibri might not be set up/available
			return writeJsonResponse(w, http.StatusCreated, response)

		}
		if err := srv.CreateUserInKolibri(newUser, kolibri); err != nil {
			log.Error("error creating user in kolibri")
		}
	}
	return writeJsonResponse(w, http.StatusCreated, response)
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) HandleDeleteUser(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	fields := log.Fields{"handler": "HandleDeleteUser", "user_id": id}
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", fields)
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err, fields)
	}
	if err := srv.deleteIdentityInKratos(&user.KratosID); err != nil {
		return newInternalServerServiceError(err, "error deleting user in kratos", fields)
	}
	if err := srv.Db.DeleteUser(id); err != nil {
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusNoContent, "User deleted successfully")
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) HandleUpdateUser(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", nil)
	}
	user := models.User{}
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		return newBadRequestServiceError(err, "invalid form data submited", nil)
	}
	defer r.Body.Close()
	toUpdate, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		log.Error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		return newDatabaseServiceError(err, nil)
	}
	if toUpdate.Username != user.Username && user.Username != "" {
		userNameExists := srv.Db.UsernameExists(user.Username)
		if userNameExists {
			return newBadRequestServiceError(err, "userexists", nil)
		}
	}
	models.UpdateStruct(&toUpdate, &user)

	updatedUser, err := srv.Db.UpdateUser(toUpdate)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, updatedUser)
}

type TempPasswordRequest struct {
	UserID uint `json:"user_id"`
}

func (srv *Server) HandleResetStudentPassword(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleResetStudentPassword"}
	temp := TempPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		fields["error"] = err.Error()
		return newJSONReqBodyServiceError(err, fields)
	}
	defer r.Body.Close()
	response := make(map[string]string)
	user, err := srv.Db.GetUserByID(uint(temp.UserID))
	if err != nil {
		fields["temp.UserID"] = temp.UserID
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
	}
	newPass := user.CreateTempPassword()
	response["temp_password"] = newPass
	response["message"] = "Temporary password assigned"
	if user.KratosID == "" {
		err := srv.HandleCreateUserKratos(user.Username, newPass)
		if err != nil {
			fields["error"] = err.Error()
			return newInternalServerServiceError(err, "Error creating user in kratos", fields)
		}
	} else {
		claims := claimsFromUser(user)
		claims.PasswordReset = true
		if err := srv.handleUpdatePasswordKratos(claims, newPass, true); err != nil {
			fields["error"] = err.Error()
			return newInternalServerServiceError(err, err.Error(), fields)
		}
	}
	return writeJsonResponse(w, http.StatusOK, response)
}
