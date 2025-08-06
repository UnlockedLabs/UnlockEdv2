package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramClassEnrollmentsRoutes() []routeDef {
	axx := models.ProgramAccess
	resolve := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		adminFeatureRoute("GET /api/program-classes/{class_id}/enrollments", srv.handleGetEnrollmentsForProgram, axx),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/enrollments", srv.handleEnrollUsersInClass, axx, resolve),
		adminValidatedFeatureRoute("PATCH /api/program-classes/{class_id}/enrollments", srv.handleUpdateProgramClassEnrollments, axx, resolve),
		adminValidatedFeatureRoute("DELETE /api/programs/{id}/classes/{class_id}/enrollments", srv.handleDeleteProgramClassEnrollments, axx, resolve),
		adminValidatedFeatureRoute("GET /api/programs/{id}/classes/{class_id}/enrollments/{enrollment_id}/attendance", srv.handleGetProgramClassEnrollmentsAttendance, axx, resolve),
		validatedFeatureRoute("GET /api/users/{id}/program-completions", srv.handleGetUserProgramCompletions, axx, UserRoleResolver("id")),
	}
}

func (srv *Server) handleGetUserProgramCompletions(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "User ID")
	}
	args := srv.getQueryContext(r)
	classID := args.MaybeID("class_id")
	enrollemnt, err := srv.Db.GetProgramCompletionsForUser(&args, userId, classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, enrollemnt, args.IntoMeta())
}

func (srv *Server) handleGetEnrollmentsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	classId, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Class ID")
	}
	status := r.URL.Query().Get("status")
	if status == "all" {
		status = ""
	}
	log.add("status", status)
	args := srv.getQueryContext(r)
	enrollments, err := srv.Db.GetProgramClassEnrollmentsForProgram(&args, classId, status)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, enrollments, args.IntoMeta())
}

func (srv *Server) handleEnrollUsersInClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	log.add("class_id", classID)
	class, err := srv.Db.GetClassByID(classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if class.CannotUpdateClass() {
		return newBadRequestServiceError(err, "cannot perform action on class that is completed cancelled or archived")
	}
	enrollment := struct {
		UserIDs []int `json:"user_ids"`
	}{}
	err = json.NewDecoder(r.Body).Decode(&enrollment)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	deactivatedUsers, err := srv.Db.DeactivatedUsersPresent(enrollment.UserIDs)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if deactivatedUsers {
		return newBadRequestServiceError(errors.New("cannot enroll deactivated user"), "deactivated user")
	}
	skipped, err := srv.Db.CreateProgramClassEnrollments(classID, enrollment.UserIDs)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	response := "users enrolled"
	if skipped > 0 {
		response = fmt.Sprintf("%d users were enrolled, %d were not added because capacity is full.", len(enrollment.UserIDs)-skipped, skipped)
	}
	return writeJsonResponse(w, http.StatusCreated, response)
}

func (srv *Server) handleDeleteProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	err = srv.Db.DeleteProgramClassEnrollments(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("class enrollment deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Class enrollment deleted successfully")
}

func (srv *Server) handleUpdateProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	adminEmail := claims.Email
	classId, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	class, err := srv.Db.GetClassByID(classId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if class.CannotUpdateClass() {
		return newBadRequestServiceError(err, "cannot perform action on class that is completed cancelled or archived")
	}
	enrollment := struct {
		EnrollmentStatus string  `json:"enrollment_status"`
		UserIDs          []int   `json:"user_ids"`
		ChangeReason     *string `json:"change_reason,omitempty"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&enrollment); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if enrollment.EnrollmentStatus == "" {
		return newInvalidIdServiceError(errors.New("enrollment status is required"), "enrollment status")
	}
	switch enrollment.EnrollmentStatus {
	case "Completed":
		err = srv.Db.GraduateEnrollments(r.Context(), adminEmail, enrollment.UserIDs, classId)
		// TODO: Class is being updated in thif call as well
	default:
		err = srv.Db.UpdateProgramClassEnrollments(classId, enrollment.UserIDs, enrollment.EnrollmentStatus, enrollment.ChangeReason)
	}
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "updated")
}

func (srv *Server) handleGetProgramClassEnrollmentsAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	page, perPage := srv.getPaginationInfo(r)
	total, attendance, err := srv.Db.GetProgramClassEnrollmentsAttendance(page, perPage, id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("total", total)
	log.info("class enrollment attendance fetched")
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, attendance, paginationData)
}
