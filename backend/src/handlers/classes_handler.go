package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

func (srv *Server) registerClassesRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	validateFacility := func(check string) RouteResolver {
		return func(tx *database.DB, r *http.Request) bool {
			claims := r.Context().Value(ClaimsKey).(*Claims)
			if claims.canSwitchFacility() {
				if check == "" {
					return true
				}
			}
			var count int64
			return tx.WithContext(r.Context()).
				Table("programs").
				Where(fmt.Sprintf("id = ? AND %s id IN (SELECT program_id FROM facilities_programs WHERE facility_id = ?)", check),
					r.PathValue("program_id"), claims.FacilityID).
				Count(&count).Error == nil && count > 0
		}
	}
	return []routeDef{
		featureRoute("GET /api/programs/{id}/classes", srv.handleGetClassesForProgram, axx),
		featureRoute("GET /api/program-classes", srv.handleIndexClassesForFacility, axx),
		/* admin */
		adminValidatedFeatureRoute("POST /api/programs/{program_id}/classes", srv.handleCreateClass, axx, validateFacility("is_active = true AND archived_at IS NULL AND")),
		adminValidatedFeatureRoute("GET /api/instructors/{id}/classes",
			srv.handleGetClassesByInstructor, axx, FacilityAdminResolver("users", "id")),
		adminFeatureRoute("POST /api/program-classes/bulk-cancel",
			srv.handleBulkCancelSessions, axx),
		validatedFeatureRoute("GET /api/program-classes/{class_id}", srv.handleGetClass, axx, resolver),
		adminValidatedFeatureRoute("GET /api/programs/{program_id}/classes/outcomes", srv.handleGetProgramClassOutcomes, axx, validateFacility("")),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/attendance-flags", srv.handleGetAttendanceFlagsForClass, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/missing-attendance", srv.handleGetMissingAttendance, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/attendance-rate", srv.handleGetCumulativeAttendanceRate, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/history", srv.handleGetClassHistory, axx, resolver),
		adminValidatedFeatureRoute("PATCH /api/program-classes", srv.handleUpdateClasses, axx, func(tx *database.DB, r *http.Request) bool {
			var programClass models.ProgramClass
			err := tx.WithContext(r.Context()).
				Table("program_classes").
				Select("facility_id").
				Where("id IN (?)", r.URL.Query()["id"]).
				Where("facility_id = ?", r.Context().Value(ClaimsKey).(*Claims).FacilityID).
				First(&programClass).Error

			return err == nil
		}),
		adminValidatedFeatureRoute("PATCH /api/programs/{id}/classes/{class_id}", srv.handleUpdateClass, axx, resolver),
	}
}

func (srv *Server) handleGetClassesForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryContext(r)
	classes, err := srv.Db.GetProgramClassDetailsByID(id, &args)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

func (srv *Server) handleGetClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	class, err := srv.Db.GetClassByID(id)
	if err != nil {
		log.add("class_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, class)
}

func (srv *Server) handleIndexClassesForFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	classes, err := srv.Db.GetClassesForFacility(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

func (srv *Server) handleCreateClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("program_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	var class models.ProgramClass
	err = json.Unmarshal(bodyBytes, &class)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	class.FacilityID = claims.FacilityID
	class.ProgramID = uint(id)

	var rawClass map[string]any
	err = json.Unmarshal(bodyBytes, &rawClass)
	if err == nil {
		if rawInstructorID, exists := rawClass["instructor_id"]; exists {
			if rawInstructorID == float64(0) {
				class.InstructorID = nil
			}
		}
	}

	if class.InstructorID != nil && *class.InstructorID > 0 {
		instructorName, err := srv.Db.GetInstructorNameByID(*class.InstructorID, claims.FacilityID)
		if err == nil && instructorName != "" {
			class.InstructorName = instructorName
		} else {
			class.InstructorName = "Unassigned"
			class.InstructorID = nil
		}
	} else {
		class.InstructorName = "Unassigned"
	}

	var conflictReq *models.ConflictCheckRequest
	if len(class.Events) > 0 && class.Events[0].RoomID != nil {
		if _, err := srv.Db.GetRoomByIDForFacility(*class.Events[0].RoomID, claims.FacilityID); err != nil {
			return newDatabaseServiceError(err)
		}
		conflictReq = &models.ConflictCheckRequest{
			FacilityID:     claims.FacilityID,
			RoomID:         *class.Events[0].RoomID,
			RecurrenceRule: class.Events[0].RecurrenceRule,
			Duration:       class.Events[0].Duration,
		}
	}

	newClass, conflicts, err := srv.WithUserContext(r).CreateProgramClass(&class, conflictReq)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if len(conflicts) > 0 {
		return writeConflictResponse(w, conflicts)
	}
	log.add("program_id", id)
	log.add("class_id", newClass.ID)
	return writeJsonResponse(w, http.StatusCreated, newClass)
}

func (srv *Server) handleUpdateClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	class := models.ProgramClass{}
	err = json.Unmarshal(bodyBytes, &class)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	var rawClass map[string]any
	err = json.Unmarshal(bodyBytes, &rawClass)
	if err == nil {
		if rawInstructorID, exists := rawClass["instructor_id"]; exists {
			if rawInstructorID == float64(0) {
				class.InstructorID = nil
			}
		}
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	if class.InstructorID != nil && *class.InstructorID > 0 {
		instructorName, err := srv.Db.GetInstructorNameByID(*class.InstructorID, claims.FacilityID)
		if err == nil && instructorName != "" {
			class.InstructorName = instructorName
		} else {
			class.InstructorName = "Unassigned"
			class.InstructorID = nil
		}
	} else {
		class.InstructorName = "Unassigned"
	}

	if class.CannotUpdateClass() {
		return newBadRequestServiceError(err, "cannot perform action on class that is completed cancelled or archived")
	}
	enrolled, err := srv.Db.GetTotalEnrollmentsByClassID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if enrolled > class.Capacity {
		return writeJsonResponse(w, http.StatusBadRequest, "Cannot update class until unenrolling residents")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	class.UpdateUserID = models.UintPtr(claims.UserID)

	var conflictReq *models.ConflictCheckRequest
	if len(class.Events) > 0 && class.Events[0].RoomID != nil {
		if _, err := srv.Db.GetRoomByIDForFacility(*class.Events[0].RoomID, claims.FacilityID); err != nil {
			return newDatabaseServiceError(err)
		}
		existing, err := srv.Db.GetClassByID(id)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		existingRoomID := uint(0)
		if len(existing.Events) > 0 && existing.Events[0].RoomID != nil {
			existingRoomID = *existing.Events[0].RoomID
		}
		if *class.Events[0].RoomID != existingRoomID {
			conflictReq = &models.ConflictCheckRequest{
				FacilityID:     claims.FacilityID,
				RoomID:         *class.Events[0].RoomID,
				RecurrenceRule: existing.Events[0].RecurrenceRule,
				Duration:       existing.Events[0].Duration,
				ExcludeEventID: &existing.Events[0].ID,
			}
		}
	}

	updated, conflicts, err := srv.WithUserContext(r).UpdateProgramClass(&class, id, conflictReq)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if len(conflicts) > 0 {
		return writeConflictResponse(w, conflicts)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleUpdateClasses(w http.ResponseWriter, r *http.Request, log sLog) error {
	ids := r.URL.Query()["id"]
	classIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		classID, err := strconv.Atoi(id)
		if err != nil {
			log.warn("invalid class ID in batch update, skipping: ", id)
			continue
		}
		classIDs = append(classIDs, classID)
	}
	classMap := make(map[string]any)
	if err := json.NewDecoder(r.Body).Decode(&classMap); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	classMap["update_user_id"] = claims.UserID

	if err := srv.WithUserContext(r).UpdateProgramClasses(classIDs, classMap); err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, "Successfully updated program class")
}

func (srv *Server) handleGetClassHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	args := srv.getQueryContext(r)
	categories := r.URL.Query()["categories"]
	historyEvents, err := srv.Db.GetChangeLogEntries(&args, "program_classes", id, categories)
	if err != nil {
		return err
	}
	pageMeta, createdByDetails, err := srv.getCreatedByForHistory(id, "program_classes", args.IntoMeta(), &args, len(historyEvents), categories)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	historyEvents = append(historyEvents, createdByDetails)
	return writePaginatedResponse(w, http.StatusOK, historyEvents, pageMeta)
}

func (srv *Server) handleGetAttendanceFlagsForClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	args := srv.getQueryContext(r)
	flags, err := srv.Db.GetAttendanceFlagsForClass(id, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, flags, args.IntoMeta())
}

func (srv *Server) handleGetProgramClassOutcomes(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("program_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryContext(r)
	outcome, err := srv.Db.GetProgramClassOutcomes(id, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, outcome)
}

func (srv *Server) handleGetMissingAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	args := srv.getQueryContext(r)
	totalMissing, err := srv.Db.GetMissingAttendance(id, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, totalMissing)
}

func (srv *Server) handleGetCumulativeAttendanceRate(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	attendanceRate, err := srv.Db.GetCumulativeAttendanceRateForClass(r.Context(), classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	response := map[string]float64{
		"attendance_rate": attendanceRate,
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func (srv *Server) handleGetClassesByInstructor(w http.ResponseWriter, r *http.Request, log sLog) error {
	instructorId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || instructorId < 0 {
		return newInvalidIdServiceError(fmt.Errorf("instructor ID must be 0 or positive"), "instructor ID")
	}

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	facilityIdStr := r.URL.Query().Get("facility_id")

	if startDate == "" || endDate == "" || facilityIdStr == "" {
		return newBadRequestServiceError(nil, "start_date, end_date, and facility_id are required")
	}

	facilityId, err := strconv.Atoi(facilityIdStr)
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}

	classes, err := srv.Db.GetClassesByInstructor(instructorId, facilityId, startDate, endDate)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, classes)
}

func (srv *Server) handleBulkCancelSessions(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req models.BulkCancelSessionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)

	// Create a claims adapter that implements the BulkCancelClaims interface
	claimsAdapter := &BulkCancelClaimsAdapter{Claims: claims}

	response, err := srv.Db.BulkCancelSessions(req.InstructorID, int(claims.FacilityID), req.StartDate, req.EndDate, req.Reason, claimsAdapter)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	log.add("instructor_id", req.InstructorID)
	log.add("start_date", req.StartDate)
	log.add("end_date", req.EndDate)
	log.add("session_count", response.SessionCount)
	log.add("class_count", response.ClassCount)

	return writeJsonResponse(w, http.StatusOK, response)
}

type BulkCancelClaimsAdapter struct {
	*Claims
}

func (c *BulkCancelClaimsAdapter) GetUserID() uint {
	return c.UserID
}

func (c *BulkCancelClaimsAdapter) GetFacilityID() uint {
	return c.FacilityID
}
