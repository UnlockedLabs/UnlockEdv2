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

func (srv *Server) registerUserRoutes() []routeDef {
	resolver := UserRoleResolver("id")
	return []routeDef{
		validatedRoute("GET /api/users/{id}", srv.handleShowUser, resolver),
		validatedRoute("GET /api/users/{id}/programs", srv.handleGetUserPrograms, resolver),
		/* admin */
		newAdminRoute("GET /api/users", srv.handleIndexUsers),
		newAdminRoute("POST /api/users", srv.handleCreateUser),
		newAdminRoute("GET /api/users/resident-verify", srv.handleResidentVerification),
		newDeptAdminRoute("PATCH /api/users/resident-transfer", srv.handleResidentTransfer),
		validatedAdminRoute("POST /api/users/{id}/student-password", srv.handleResetStudentPassword, func(tx *database.DB, r *http.Request) bool {
			var role string
			return tx.WithContext(r.Context()).Model(&models.User{}).Select("role").Where("id = ?", r.PathValue("id")).First(&role).Error == nil &&
				canResetUserPassword(r.Context().Value(ClaimsKey).(*Claims), models.UserRole(role))
		}),
		validatedAdminRoute("DELETE /api/users/{id}", srv.handleDeleteUser, FacilityAdminResolver("users", "id")),
		validatedAdminRoute("PATCH /api/users/{id}", srv.handleUpdateUser, FacilityAdminResolver("users", "id")),
		validatedAdminRoute("GET /api/users/{id}/account-history", srv.handleGetUserAccountHistory, resolver),
	}
}

func (srv *Server) handleIndexUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	role := r.URL.Query().Get("role")
	args := srv.getQueryContext(r)
	include := r.URL.Query()["include"]
	var users []models.User
	var err error
	switch {
	case slices.Contains(include, "only_unmapped"):
		providerId := r.URL.Query().Get("provider_id")
		return srv.handleGetUnmappedUsers(w, r, providerId, log)

	case slices.Contains(include, "only_unenrolled"):
		classID, err := strconv.Atoi(r.URL.Query().Get("class_id"))
		if err != nil {
			return newInvalidIdServiceError(err, "class ID")
		}
		users, err = srv.Db.GetEligibleResidentsForClass(&args, classID)
		if err != nil {
			log.add("facility_id", args.FacilityID)
			log.add("search", args.Search)
			return newDatabaseServiceError(err)
		}
	default:
		users, err = srv.Db.GetCurrentUsers(&args, role)
		if err != nil {
			log.add("facility_id", args.FacilityID)
			log.add("search", args.Search)
			return newDatabaseServiceError(err)
		}
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
	claims := r.Context().Value(ClaimsKey).(*Claims)
	reqForm := struct {
		User      models.User `json:"user"`
		Providers []int       `json:"provider_platforms"`
	}{}
	err := json.NewDecoder(r.Body).Decode(&reqForm)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if reqForm.User.FacilityID == 0 {
		reqForm.User.FacilityID = claims.FacilityID
	}
	invalidUser := validateUser(&reqForm.User)
	if invalidUser != "" {
		return newBadRequestServiceError(errors.New("invalid username"), invalidUser)
	}
	log.add("created_username", reqForm.User.Username)
	userNameExists, docExists := srv.Db.UserIdentityExists(reqForm.User.Username, reqForm.User.DocID)
	if userNameExists {
		return newBadRequestServiceError(err, "userexists")
	}
	if docExists {
		return newBadRequestServiceError(err, "docexists")
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
	if reqForm.User.Role == models.Student {
		accountCreation := models.NewUserAccountHistory(reqForm.User.ID, models.AccountCreation, &claims.UserID, nil, nil)
		if err := srv.Db.InsertUserAccountHistoryAction(r.Context(), accountCreation); err != nil {
			return newCreateRequestServiceError(err)
		}
		facilityTransfer := models.NewUserAccountHistory(reqForm.User.ID, models.FacilityTransfer, &claims.UserID, nil, &claims.FacilityID)
		if err := srv.Db.InsertUserAccountHistoryAction(r.Context(), facilityTransfer); err != nil {
			return newCreateRequestServiceError(err)
		}
	}
	// register the user as an Identity with Kratos + Kolibri
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
		log.add("user_id", reqForm.User.ID)
		log.error("error creating user in kolibri")
	}
	return writeJsonResponse(w, http.StatusCreated, response)
}

/**
* DELETE: /api/users/{id}
 */
func (srv *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	log.add("user_id", id)
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user, err := srv.Db.GetUserByID(uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("deleted_username", user.Username)
	if err := srv.deleteIdentityInKratos(r.Context(), &user.KratosID); err != nil {
		log.add("deleted_kratos_id", user.KratosID)
		return newInternalServerServiceError(err, "error deleting user in kratos")
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
	toUpdate, err := srv.Db.GetUserByID(uint(id))
	log.add("userId", id)
	if err != nil {
		log.error("Error getting user by ID:" + fmt.Sprintf("%d", id))
		return newDatabaseServiceError(err)
	}
	if toUpdate.Username != user.Username && user.Username != "" {
		// usernames are immutable
		return newBadRequestServiceError(errors.New("username cannot be updated"), "username")
	}
	if user.DocID == "" && toUpdate.DocID != "" {
		user.DocID = toUpdate.DocID
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
	claims := r.Context().Value(ClaimsKey).(*Claims)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInternalServerServiceError(err, "id")
	}
	response := make(map[string]string)
	user, err := srv.Db.GetUserByID(uint(id))
	log.add("student.user_id", user.ID)
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
			log.add("claims.user_id", claims.UserID)
			return newInternalServerServiceError(err, err.Error())
		}
	}
	resetPassword := models.NewUserAccountHistory(user.ID, models.ResetPassword, &claims.UserID, nil, nil)
	if err := srv.Db.InsertUserAccountHistoryAction(r.Context(), resetPassword); err != nil {
		return newCreateRequestServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func canResetUserPassword(currentUser *Claims, toUpdate models.UserRole) bool {
	switch toUpdate {
	case models.DepartmentAdmin: // department admin can only reset password of users in their department
		return currentUser.canSwitchFacility()
	case models.SystemAdmin: // system admin can only reset password of other system admins
		return currentUser.Role == toUpdate
	default: // user is garaunteed to be admin already at this point, can reset facility + student passwords
		return currentUser.isAdmin()
	}
}

func validateUser(user *models.User) string {
	if strings.ContainsFunc(user.Username, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) }) {
		return "alphanum"
	} else if strings.ContainsFunc(user.NameFirst, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsSpace(r) && r != '-' }) {
		return "alphanum"
	} else if strings.ContainsFunc(user.NameLast, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsSpace(r) && r != '-'
	}) {
		return "alphanum"
	}
	return ""
}

func (srv *Server) handleGetUserAccountHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	args := srv.getQueryContext(r)
	history, err := srv.Db.GetUserAccountHistory(&args, uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, history, args.IntoMeta())
}

func (srv *Server) handleResidentVerification(w http.ResponseWriter, r *http.Request, log sLog) error {
	transferFacilityId, err := strconv.Atoi(r.URL.Query().Get("facility_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("trans_facility_id", transferFacilityId)
	userID, err := strconv.Atoi(r.URL.Query().Get("user_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userID)
	docID := r.URL.Query().Get("doc_id")
	ctx := r.Context()
	user, err := srv.Db.GetUserByDocIDAndID(ctx, docID, userID)
	if err != nil {
		return writeJsonResponse(w, http.StatusNotFound, "Resident not found")
	}
	log.add("doc_id", docID)
	programNames, err := srv.Db.GetTransferProgramConflicts(ctx, user.ID, transferFacilityId)
	if err != nil {
		return writeJsonResponse(w, http.StatusNotFound, "Resident not found")
	}
	transferNotes := struct {
		User            models.User `json:"user"`
		ProgramNames    []string    `json:"program_names"`
		TransFacilityID int         `json:"trans_facility_id"`
	}{
		User:            *user,
		ProgramNames:    programNames,
		TransFacilityID: transferFacilityId,
	}
	return writeJsonResponse(w, http.StatusOK, transferNotes)
}

func (srv *Server) handleResidentTransfer(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	var transRequest struct {
		UserID          int `json:"user_id"`
		TransFacilityID int `json:"trans_facility_id"`
		CurrFacilityID  int `json:"curr_facility_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&transRequest); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	log.add("user_id", transRequest.UserID)
	log.add("admin_id", args.UserID)
	log.add("transfer_facility_id", transRequest.TransFacilityID)
	log.add("current_facility_id", transRequest.CurrFacilityID)
	tx, err := srv.Db.TransferResident(&args, transRequest.UserID, transRequest.CurrFacilityID, transRequest.TransFacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	err = srv.updateFacilityInKratosIdentity(transRequest.UserID, transRequest.TransFacilityID)
	if err != nil {
		tx.Rollback()
		return newInternalServerServiceError(err, "error updating facility in kratos")
	}
	log.info("successfully transferred resident")
	transFacilityID := uint(transRequest.TransFacilityID)
	facilityTransfer := models.NewUserAccountHistory(uint(transRequest.UserID), models.FacilityTransfer, &args.UserID, nil, &transFacilityID)
	if err := srv.Db.InsertUserAccountHistoryAction(r.Context(), facilityTransfer); err != nil {
		tx.Rollback()
		return newCreateRequestServiceError(err)
	}
	if err := tx.Commit().Error; err != nil {
		// transfer back to original facility if we cannot commit tx
		err = srv.updateFacilityInKratosIdentity(transRequest.UserID, transRequest.CurrFacilityID)
		// pray that this never happens 🙏
		log.error("Error committing transaction AND updating user facility in kratos: " + err.Error())
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "successfully transferred resident")
}

func (srv *Server) handleGetUserPrograms(w http.ResponseWriter, r *http.Request, log sLog) error {
	id := r.PathValue("id")
	userId, err := strconv.Atoi(id)
	if err != nil {
		return newInvalidIdServiceError(err, "error converting user_id")
	}
	queryCtx := srv.getQueryContext(r)
	userPrograms, err := srv.Db.GetUserProgramInfo(&queryCtx, userId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	for i := range userPrograms {
		present := userPrograms[i].PresentAttendance
		absent := userPrograms[i].AbsentAttendance
		total := present + absent

		if total == 0 {
			userPrograms[i].AttendancePercentage = "0%"
		} else {
			pct := float64(present) / float64(total) * 100
			userPrograms[i].AttendancePercentage = fmt.Sprintf("%.0f%%", pct)
		}
	}
	return writePaginatedResponse(w, http.StatusOK, userPrograms, queryCtx.IntoMeta())
}
