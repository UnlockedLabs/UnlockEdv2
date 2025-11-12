package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/jasper"
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/go-pdf/fpdf"
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
		newAdminRoute("POST /api/users/bulk/upload", srv.handleBulkUpload),
		newAdminRoute("POST /api/users/bulk/create", srv.handleBulkCreate),
		validatedAdminRoute("POST /api/users/{id}/deactivate", srv.handleDeactivateUser, FacilityAdminResolver("users", "id")),
		newAdminRoute("GET /api/users/{id}/usage-report", srv.handleGenerateUsageReportPDF),
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
type UserResponse struct {
	ID            uint                 `json:"id"`
	Username      string               `json:"username"`
	NameFirst     string               `json:"name_first"`
	NameLast      string               `json:"name_last"`
	Email         string               `json:"email"`
	Role          models.UserRole      `json:"role"`
	DocID         string               `json:"doc_id"`
	DeactivatedAt *time.Time           `json:"deactivated_at,omitempty"`
	Facility      *models.Facility     `json:"facility,omitempty"`
	LoginMetrics  *models.LoginMetrics `json:"login_metrics,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

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

	resp := UserResponse{
		ID:            user.ID,
		Username:      user.Username,
		NameFirst:     user.NameFirst,
		NameLast:      user.NameLast,
		Email:         user.Email,
		Role:          user.Role,
		DocID:         user.DocID,
		DeactivatedAt: user.DeactivatedAt,
		Facility:      user.Facility,
		LoginMetrics:  user.LoginMetrics,
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
	}
	return writeJsonResponse(w, http.StatusOK, resp)
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
	tempPw, err := reqForm.User.CreateTempPassword()
	if err != nil {
		return newInternalServerServiceError(err, "Error creating temporary password")
	}
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
	if !srv.testingMode {
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
	// Check if user is deactivated
	if toUpdate.DeactivatedAt != nil {
		return newBadRequestServiceError(errors.New("cannot update deactivated user"), "User is deactivated")
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
	lockedStatus, err := srv.Db.IsAccountLocked(user.ID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if lockedStatus.IsLocked {
		log.infof("Resetting failed login attempts for user %d due to password reset", user.ID)
		err = srv.Db.ResetFailedLoginAttempts(user.ID)
		if err != nil {
			return newDatabaseServiceError(err)
		}
	}
	newPass, err := user.CreateTempPassword()
	if err != nil {
		return newInternalServerServiceError(err, "Error creating temporary password")
	}
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
	categories := r.URL.Query()["categories"]
	history, err := srv.Db.GetUserAccountHistory(&args, uint(id), categories)
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
		User            models.User                               `json:"user"`
		ProgramNames    []models.ResidentTransferProgramConflicts `json:"program_names"`
		TransFacilityID int                                       `json:"trans_facility_id"`
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

	user, err := srv.Db.GetUserByID(uint(transRequest.UserID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if user.DeactivatedAt != nil {
		return newBadRequestServiceError(errors.New("cannot transfer deactivated user"), "User is deactivated")
	}
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
		userPrograms[i].CalculateAttendancePercentage()
	}
	return writePaginatedResponse(w, http.StatusOK, userPrograms, queryCtx.IntoMeta())
}

func (srv *Server) handleBulkUpload(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)

	err := r.ParseMultipartForm(5 << 20) // 5mb file size limit for reference
	if err != nil {
		log.add("error", "failed to parse multipart form")
		return newBadRequestServiceError(err, "file too large or invalid format")
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.errorf("error closing file %v", err)
	}

	defer func() {
		if file.Close() != nil {
			log.errorf("Failed to close file %v", err)
		}
	}()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".csv") {
		log.add("filename", header.Filename)
		return newBadRequestServiceError(errors.New("invalid file type"), "file type not supported - only .csv files can be uploaded")
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.add("error", "failed to read file")
		return newInternalServerServiceError(err, "failed to read file")
	}

	if len(fileBytes) == 0 {
		return newBadRequestServiceError(errors.New("empty file"), "file is empty - no data found")
	}

	log.add("filename", header.Filename)
	log.add("file_size", len(fileBytes))
	log.add("facility_id", claims.FacilityID)

	records, err := src.ParseCSVFile(fileBytes)
	if err != nil {
		log.add("parse_error", err.Error())
		return newBadRequestServiceError(err, err.Error())
	}

	if len(records) == 0 {
		return newBadRequestServiceError(errors.New("empty file"), "file is empty - no data found")
	}

	headers := records[0]
	headerMap, err := src.ValidateCSVHeaders(headers)
	if err != nil {
		log.add("validation_error", err.Error())
		return newBadRequestServiceError(err, err.Error())
	}

	var validRows []models.ValidatedUserRow
	var invalidRows []models.InvalidUserRow
	existingResidentIDs := make(map[string]int)
	existingUsernames := make(map[string]int)

	checkIdentity := func(username string, docID string) (bool, bool) {
		return srv.Db.UserIdentityExists(username, docID)
	}

	for i, record := range records[1:] {
		rowNum := i + 2

		validRow, invalidRow := src.ValidateUserRow(record, rowNum, headerMap, existingResidentIDs, checkIdentity, existingUsernames)
		if validRow != nil {
			validRows = append(validRows, *validRow)
		}
		if invalidRow != nil {
			invalidRows = append(invalidRows, *invalidRow)
		}
	}

	log.add("valid_count", len(validRows))
	log.add("error_count", len(invalidRows))
	log.info("CSV upload processed and validated")

	var errorCSVData []byte
	if len(invalidRows) > 0 {
		errorCSVData, err = src.GenerateErrorCSV(invalidRows)
		if err != nil {
			log.add("error", err.Error())
			return newInternalServerServiceError(err, "failed to generate error report")
		}
	}

	response := models.BulkUploadResponse{
		ValidCount:   len(validRows),
		ErrorCount:   len(invalidRows),
		ValidRows:    validRows,
		InvalidRows:  invalidRows,
		ErrorCSVData: errorCSVData,
	}

	return writeJsonResponse(w, http.StatusOK, response)
}

func (srv *Server) handleBulkCreate(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)

	var validRows []models.ValidatedUserRow

	if err := json.NewDecoder(r.Body).Decode(&validRows); err != nil {
		log.add("error", "failed to decode request body")
		return newBadRequestServiceError(err, "invalid request body")
	}

	if len(validRows) == 0 {
		return newBadRequestServiceError(errors.New("no valid rows"), "no valid rows provided for user creation")
	}

	log.add("admin_id", claims.UserID)
	log.add("facility_id", claims.FacilityID)
	log.add("users_to_create", len(validRows))

	usersToCreate := make([]models.User, 0, len(validRows))
	for _, validRow := range validRows {
		user := models.User{
			Username: stripNonAlphaChars(validRow.Username, func(char rune) bool {
				return unicode.IsLetter(char) || unicode.IsDigit(char)
			}),
			NameFirst:  validRow.FirstName,
			NameLast:   validRow.LastName,
			DocID:      validRow.ResidentID,
			Role:       models.Student,
			FacilityID: claims.FacilityID,
		}
		usersToCreate = append(usersToCreate, user)
	}

	err := srv.Db.CreateUsersBulk(usersToCreate, claims.UserID)
	if err != nil {
		log.add("transaction_error", err.Error())
		log.error("Bulk user creation transaction failed")
		return newDatabaseServiceError(err)
	}

	log.add("created_users", len(usersToCreate))
	log.info("Bulk user creation transaction completed successfully")

	return writeJsonResponse(w, http.StatusOK, len(usersToCreate))
}

func (srv *Server) handleDeactivateUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	err = srv.Db.DeactivateUser(r.Context(), uint(id), &claims.UserID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, "User deactivated successfully")
}

func (srv *Server) handleGenerateUsageReportPDF(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "error converting user_id")
	}

	jasperService := jasper.NewJasperService(srv.Db, srv.testingMode)
	pdfBytes, err := jasperService.GenerateUsageReportPDF(userID)
	if err != nil {
		log.errorf("jasper service error: %v", err)
		return newInternalServerServiceError(err, "failed to generate PDF report")
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=transcript.pdf")

	_, err = w.Write(pdfBytes)
	return err
}

func (srv *Server) buildUsageReportPDF(user *models.User, programs []models.ResidentProgramClassInfo, engagements []models.SessionEngagement, resourceCount int64) *fpdf.Fpdf {
	pdf := fpdf.New("P", "mm", "Letter", "")
	pdf.AddPage()

	unlockedLogo := pdf.RegisterImageOptionsReader(
		"logo",
		fpdf.ImageOptions{ImageType: "PNG"},
		bytes.NewReader(src.UnlockedLogoImg),
	)

	margin := 10.0
	if unlockedLogo != nil { //adding logo here
		const imageHeight = 30.48 //added fixed hieght
		aspectRatio := unlockedLogo.Width() / unlockedLogo.Height()
		imageWidth := imageHeight * aspectRatio // Place image on the top-left
		//this is what places the image into the PDF
		pdf.ImageOptions(
			"logo",
			margin,
			margin,
			imageWidth,
			imageHeight,
			false,
			fpdf.ImageOptions{ImageType: "PNG"},
			0,
			"",
		)
		titleCellHeight := 10.0
		titleY := margin + (imageHeight / 2) - (titleCellHeight / 2)
		titleX := margin + imageWidth + 5
		pdf.SetXY(titleX, titleY)

		pdf.SetFont("Arial", "B", 24)
		pdf.Cell(0, titleCellHeight, "Resident Usage Transcript")

		pdf.SetY(margin + imageHeight)
		pdf.Ln(10)
		pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
		pdf.Ln(10)
	} else { //in case the image doesn't load doing this
		pdf.SetFont("Arial", "B", 24)
		pdf.Cell(0, 10, "Resident Usage Transcript")
		pdf.Ln(10)
		pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
		pdf.Ln(10)
	}

	//add resident information start
	pdf.SetFont("Arial", "", 12)
	writeLine(pdf, "Resident: "+user.NameFirst+" "+user.NameLast)
	writeLine(pdf, "ID: "+user.DocID)
	writeLine(pdf, "Facility: "+user.Facility.Name)
	writeLine(pdf, "Generated Date: "+time.Now().Format("January 2, 2006"))
	writeLine(pdf, "Date Range: "+user.CreatedAt.Format("January 2, 2006")+" - present")
	pdf.Ln(10)

	//add platform usage information start
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "Platform Usage")
	pdf.Ln(10)
	pdf.SetFont("Arial", "", 12)

	duration := "none" //possible there is none
	if len(engagements) > 0 {
		duration = formatDurationFromMinutes(engagements[0].TotalMinutes)
	}
	writeLine(pdf, "Total time spent on UnlockEd: "+duration)

	totalLogins := "0" //logins can be 0
	if user.LoginMetrics != nil {
		totalLogins = fmt.Sprintf("%d", user.LoginMetrics.Total)
	}
	writeLine(pdf, "Total Logins: "+totalLogins)
	writeLine(pdf, fmt.Sprintf("Distinct resources accessed: %d", resourceCount))

	if srv.hasFeatureAccess(models.ProgramAccess) { //add program participation start only if feature is turned on
		pdf.Ln(10)
		pdf.SetFont("Arial", "B", 16)
		pdf.Cell(0, 10, "Program Participation")
		pdf.Ln(10)
		headers := []string{"Program\nName", "Class\nName", "Status", "Attendance", "Start Date", "End Date"}
		widths := []float64{40, 30, 25, 25, 30, 30}
		var rows [][]string
		for _, program := range programs {
			rows = append(rows, []string{
				program.ProgramName,
				program.ClassName,
				string(program.Status),
				program.CalculateAttendancePercentage(),
				formatDateForDisplay(program.StartDate),
				formatDateForDisplay(program.EndDate),
			})
		}
		drawDataTable(pdf, headers, rows, widths)
	}
	return pdf
}
