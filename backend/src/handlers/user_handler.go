package handlers

import (
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

func (srv *Server) registerUserRoutes() []routeDef {
	axx := models.Feature()
	return []routeDef{
		{"GET /api/users", srv.handleIndexUsers, true, axx},
		{"GET /api/users/{id}", srv.handleShowUser, false, axx},
		{"POST /api/users", srv.handleCreateUser, true, axx},
		{"DELETE /api/users/{id}", srv.handleDeleteUser, true, axx},
		{"PATCH /api/users/{id}", srv.handleUpdateUser, true, axx},
		{"POST /api/users/student-password", srv.handleResetStudentPassword, true, axx},
	}
}

/**
* GET: /api/users
**/
func (srv *Server) handleIndexUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	include := r.URL.Query()["include"]
	if slices.Contains(include, "only_unmapped") {
		providerId := r.URL.Query().Get("provider_id")
		return srv.handleGetUnmappedUsers(w, r, providerId, log)
	}
	role := r.URL.Query().Get("role")
	args := srv.getQueryContext(r)
	users, err := srv.Db.GetCurrentUsers(&args, role)
	if err != nil {
		log.add("facility_id", args.FacilityID)
		log.add("search", args.Search)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, users, args.IntoMeta())
}

func (srv *Server) handleGetUnmappedUsers(w http.ResponseWriter, r *http.Request, providerId string, log sLog) error {
	log.add("subhandlerCall", "HandleGetUnmappedUsers")
	args := srv.getQueryContext(r)
	provID, err := strconv.Atoi(providerId)
	if err != nil {
		return newInvalidIdServiceError(err, "provider ID")
	}
	search := r.URL.Query()["search"]
	users, err := srv.Db.GetUnmappedUsers(&args, provID, search)
	if err != nil {
		log.add("provider_id", providerId)
		log.add("facility_id", args.FacilityID)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, users, args.IntoMeta())
}

/**
* GET: /api/users/{id}
**/
func (srv *Server) handleShowUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	if !srv.canViewUserData(r, id) {
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

/**
* POST: /api/users
* TODO: transactional
**/
func (srv *Server) handleCreateUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	reqForm := struct {
		User      models.User `json:"user"`
		Providers []int       `json:"provider_platforms"`
	}{}
	err := json.NewDecoder(r.Body).Decode(&reqForm)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	log.info("BEFORE THE CALLL!!!!!!!!!!")
	log.audit(r, ">>>>>>>>>>>>>>>>>>>>>>Create User")

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
	reqForm.User.Username = stripNonAlphaChars(reqForm.User.Username, func(char rune) bool {
		return unicode.IsLetter(char) || unicode.IsDigit(char)
	})

	err = srv.Db.CreateUser(&reqForm.User)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	for _, providerID := range reqForm.Providers {
		provider, err := srv.Db.GetProviderPlatformByID(providerID)
		if err != nil {
			log.add("provider_id", providerID)
			log.error("Error getting provider platform by id createProviderUserAccount")
			return newDatabaseServiceError(err)
		}
		if err = srv.createAndRegisterProviderUserAccount(provider, &reqForm.User); err != nil {
			log.add("provider_id", providerID)
			log.error("Error creating provider user account for provider: ", provider.Name)
		}
	}
	tempPw := reqForm.User.CreateTempPassword()
	response := struct {
		TempPassword string      `json:"temp_password"`
		User         models.User `json:"user"`
	}{
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
	log.audit(r, ">>>>>>>>>>>>>>>>>>>>>>Delete User")
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !srv.isTesting(r) {
		if err := srv.deleteIdentityInKratos(&user.KratosID); err != nil {
			log.add("Kratos_id", user.KratosID)
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
* NOTE: Method is not configured to update (sync) role and username fields within kratos identity (Traits)
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
	log.audit(r, ">>>>>>>>>>>>>>>>>>>>>>Create User")
	if err != nil {
		log.error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		return newDatabaseServiceError(err)
	}
	if toUpdate.Username != user.Username && user.Username != "" {
		// usernames are immutable
		return newBadRequestServiceError(errors.New("username cannot be updated"), "username")
	}
	invalidUser := validateUser(&user)
	if invalidUser != "" {
		return newBadRequestServiceError(errors.New("invalid username"), invalidUser)
	}
	models.UpdateStruct(toUpdate, &user)
	err = srv.Db.UpdateUser(toUpdate)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, toUpdate)
}

func (srv *Server) handleResetStudentPassword(w http.ResponseWriter, r *http.Request, log sLog) error {
	temp := struct {
		UserID uint `json:"user_id"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&temp); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	response := make(map[string]string)
	user, err := srv.Db.GetUserByID(uint(temp.UserID))
	log.add("student.user_id", temp.UserID)
	log.audit(r, ">>>>>>>>>>>>>>>>>>>>>>Update User")
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
				log.add("claims.user_id", claims.UserID)
				return newInternalServerServiceError(err, err.Error())
			}
		}
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func validateUser(user *models.User) string {
	if strings.ContainsFunc(user.Username, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) }) {
		return "alphanum"
	} else if strings.ContainsFunc(user.NameFirst, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsSpace(r) }) {
		return "alphanum"
	}
	return ""
}
