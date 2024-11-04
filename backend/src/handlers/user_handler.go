package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

func (srv *Server) registerUserRoutes() {
	srv.Mux.Handle("GET /api/users", srv.applyAdminMiddleware(srv.handleIndexUsers))
	srv.Mux.Handle("GET /api/users/{id}", srv.applyMiddleware(srv.handleShowUser))
	srv.Mux.Handle("POST /api/users", srv.applyAdminMiddleware(srv.handleCreateUser))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.applyAdminMiddleware(srv.handleDeleteUser))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.applyAdminMiddleware(srv.handleUpdateUser))
	srv.Mux.Handle("POST /api/users/student-password", srv.applyAdminMiddleware(srv.handleResetStudentPassword))
}

/**
* GET: /api/users
**/
func (srv *Server) handleIndexUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	include := r.URL.Query()["include"]
	if slices.Contains(include, "logins") {
		return srv.handleGetUsersWithLogins(w, r.WithContext(r.Context()), log)
	}
	if slices.Contains(include, "only_unmapped") {
		providerId := r.URL.Query().Get("provider_id")
		return srv.handleGetUnmappedUsers(w, r, providerId, log)
	}
	order := r.URL.Query().Get("order_by")
	search := strings.ToLower(r.URL.Query().Get("search"))
	search = strings.TrimSpace(search)
	role := r.URL.Query().Get("role")
	facilityId := srv.getFacilityID(r)
	total, users, err := srv.Db.GetCurrentUsers(page, perPage, facilityId, order, search, role)
	if err != nil {
		log.add("facilityId", facilityId)
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, users, paginationData)
}

func (srv *Server) handleGetUnmappedUsers(w http.ResponseWriter, r *http.Request, providerId string, log sLog) error {
	log.add("subhandlerCall", "HandleGetUnmappedUsers")
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query()["search"]
	provID, err := strconv.Atoi(providerId)
	if err != nil {
		return newInvalidIdServiceError(err, "provider ID")
	}
	total, users, err := srv.Db.GetUnmappedUsers(page, perPage, provID, search, facilityId)
	if err != nil {
		log.add("providerId", providerId)
		log.add("facilityId", facilityId)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	log.infof("Total users to return: %d", total)
	return writePaginatedResponse(w, http.StatusOK, users, paginationData)
}

func (srv *Server) handleGetUsersWithLogins(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.add("subhandlerCall", "HandleGetUsersWithLogins")
	facilityId := srv.getFacilityID(r)
	page, perPage := srv.getPaginationInfo(r)
	total, users, err := srv.Db.GetUsersWithLogins(page, perPage, facilityId)
	if err != nil {
		log.add("facilityId", facilityId)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
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
func (srv *Server) handleShowUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	if !srv.canViewUserData(r) {
		log.warn("Unauthorized access to user data")
		return newUnauthorizedServiceError()
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		log.add("userId", id)
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
* TODO: transactional
**/
func (srv *Server) handleCreateUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	reqForm := CreateUserRequest{}
	err := json.NewDecoder(r.Body).Decode(&reqForm)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if reqForm.User.FacilityID == 0 {
		reqForm.User.FacilityID = srv.getFacilityID(r)
	}
	invalidUser := validateUser(&reqForm.User)
	if invalidUser != "" {
		return newBadRequestServiceError(errors.New("invalid username"), invalidUser)
	}
	userNameExists := srv.Db.UsernameExists(reqForm.User.Username)
	if userNameExists {
		return newBadRequestServiceError(err, "userexists")
	}
	reqForm.User.Username = stripNonAlphaChars(reqForm.User.Username)
	err = database.Validate().Struct(reqForm.User)
	if err != nil {
		return newBadRequestServiceError(err, "user did not pass validation")
	}
	err = srv.Db.CreateUser(&reqForm.User)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	for _, providerID := range reqForm.Providers {
		provider, err := srv.Db.GetProviderPlatformByID(providerID)
		if err != nil {
			log.add("providerID", providerID)
			log.error("Error getting provider platform by id createProviderUserAccount")
			return newDatabaseServiceError(err)
		}
		if err = srv.createAndRegisterProviderUserAccount(provider, &reqForm.User); err != nil {
			log.add("providerID", providerID)
			log.error("Error creating provider user account for provider: ", provider.Name)
		}
	}
	tempPw := reqForm.User.CreateTempPassword()
	response := NewUserResponse{
		User:         reqForm.User,
		TempPassword: tempPw,
	}
	// if we aren't in a testing environment, register the user as an Identity with Kratos + Kolibri
	if !srv.isTesting(r) {
		if err := srv.HandleCreateUserKratos(reqForm.User.Username, tempPw); err != nil {
			log.infof("Error creating user in kratos: %v", err)
		}
		kolibri, err := srv.Db.FindKolibriInstance()
		if err != nil {
			log.error("error getting kolibri instance")
			// still return 201 because user has been created in kratos,
			// kolibri might not be set up/available
			return writeJsonResponse(w, http.StatusCreated, response)
		}
		if err := srv.CreateUserInKolibri(&reqForm.User, kolibri); err != nil {
			log.add("userId", reqForm.User.ID)
			log.error("error creating user in kolibri")
		}
	}
	return writeJsonResponse(w, http.StatusCreated, response)
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	log.add("userId", id)
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !srv.isTesting(r) {
		if err := srv.deleteIdentityInKratos(&user.KratosID); err != nil {
			log.add("KratosID", user.KratosID)
			return newInternalServerServiceError(err, "error deleting user in kratos")
		}
	}
	if err := srv.Db.DeleteUser(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "User deleted successfully")
}

/**
* PATCH: /api/users/{id}
**/
func (srv *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request, log sLog) error {
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
	log.add("userId", id)
	if err != nil {
		log.error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		return newDatabaseServiceError(err)
	}
	if toUpdate.Username != user.Username && user.Username != "" {
		if srv.Db.UsernameExists(user.Username) {
			return newBadRequestServiceError(err, "userexists")
		}
	}
	invalidUser := validateUser(&user)
	if invalidUser != "" {
		return newBadRequestServiceError(errors.New("invalid username"), invalidUser)
	}
	err = srv.Db.UpdateUser(toUpdate)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, toUpdate)
}

type TempPasswordRequest struct {
	UserID uint `json:"user_id"`
}

func (srv *Server) handleResetStudentPassword(w http.ResponseWriter, r *http.Request, log sLog) error {
	temp := TempPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	response := make(map[string]string)
	user, err := srv.Db.GetUserByID(uint(temp.UserID))
	log.add("temp.UserID", temp.UserID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	newPass := user.CreateTempPassword()
	response["temp_password"] = newPass
	response["message"] = "Temporary password assigned"
	if user.KratosID == "" && !srv.isTesting(r) {
		err := srv.HandleCreateUserKratos(user.Username, newPass)
		if err != nil {
			return newInternalServerServiceError(err, "Error creating user in kratos")
		}
	} else {
		claims := claimsFromUser(user)
		claims.PasswordReset = true
		if !srv.isTesting(r) {
			if err := srv.handleUpdatePasswordKratos(claims, newPass, true); err != nil {
				log.add("claims.UserID", claims.UserID)
				return newInternalServerServiceError(err, err.Error())
			}
		}
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func validateUser(user *models.User) string {
	validateFunc := func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	}
	for _, tag := range []string{user.Username, user.NameFirst, user.NameLast} {
		if tag == "" {
			continue
		}
		if strings.ContainsFunc(tag, validateFunc) {
			return "alphanum"
		}
	}
	return ""
}
