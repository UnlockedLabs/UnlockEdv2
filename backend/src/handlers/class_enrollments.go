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
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/programs/{id}/classes/{class_id}/enrollments", srv.handleGetEnrollmentsForProgram, false, axx},
		{"POST /api/programs/{id}/classes/{class_id}/enrollments", srv.handleEnrollUsersInClass, true, axx},
		{"DELETE /api/programs/{id}/classes/{class_id}/enrollments", srv.handleDeleteProgramClassEnrollments, true, axx},
		{"PATCH /api/programs/{id}/classes/{class_id}/enrollments", srv.handleUpdateProgramClassEnrollments, true, axx},
		{"GET /api/programs/{id}/classes/{class_id}/enrollments/{enrollment_id}/attendance", srv.handleGetProgramClassEnrollmentsAttendance, true, axx},
		{"GET /api/users/{id}/program-completions", srv.handleGetUserProgramCompletions, false, axx},
	}
}

func (srv *Server) handleGetUserProgramCompletions(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "User ID")
	}
	classId, err := strconv.Atoi(r.URL.Query().Get("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Class ID")
	}
	args := srv.getQueryContext(r)
	if !srv.canViewUserData(r, userId) {
		return newUnauthorizedServiceError()
	}
	enrollemnt, err := srv.Db.GetProgramCompletionsForUser(&args, userId, classId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, enrollemnt)
}

func (srv *Server) handleGetEnrollmentsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Program ID")
	}
	classId, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Class ID")
	}
	status := r.URL.Query().Get("status")
	if status == "all" {
		status = ""
	}
	log.add("program_id", id)
	log.add("status", status)
	args := srv.getQueryContext(r)
	enrollemnts, err := srv.Db.GetProgramClassEnrollmentsForProgram(&args, id, classId, status)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, args.IntoMeta())
}

func (srv *Server) handleEnrollUsersInClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	log.add("class_id", classID)
	enrollment := struct {
		UserIDs []int `json:"user_ids"`
	}{}
	defer r.Body.Close()
	err = json.NewDecoder(r.Body).Decode(&enrollment)
	if err != nil {
		return newJSONReqBodyServiceError(err)
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
	defer r.Body.Close()
	enrollment := struct {
		EnrollmentStatus string `json:"enrollment_status"`
		UserIDs          []int  `json:"user_ids"`
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
	default:
		err = srv.Db.UpdateProgramClassEnrollments(classId, enrollment.UserIDs, enrollment.EnrollmentStatus)
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
