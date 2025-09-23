package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
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
		validatedFeatureRoute("GET /api/program-classes/{class_id}", srv.handleGetClass, axx, resolver),
		adminValidatedFeatureRoute("GET /api/programs/{program_id}/classes/outcomes", srv.handleGetProgramClassOutcomes, axx, validateFacility("")),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/attendance-flags", srv.handleGetAttendanceFlagsForClass, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/missing-attendance", srv.handleGetMissingAttendance, axx, resolver),
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
	var class models.ProgramClass
	err = json.NewDecoder(r.Body).Decode(&class)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	class.FacilityID = claims.FacilityID
	class.CreateUserID = claims.UserID
	class.ProgramID = uint(id)
	newClass, err := srv.Db.CreateProgramClass(&class)
	if err != nil {
		return newDatabaseServiceError(err)
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
	class := models.ProgramClass{}
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		return newJSONReqBodyServiceError(err)
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
	class.UpdateUserID = claims.UserID
	updated, err := srv.Db.UpdateProgramClass(r.Context(), &class, id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleUpdateClasses(w http.ResponseWriter, r *http.Request, log sLog) error {
	ids := r.URL.Query()["id"]
	classIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if classID, err := strconv.Atoi(id); err == nil {
			classIDs = append(classIDs, classID)
		}
	}
	classMap := make(map[string]any)
	if err := json.NewDecoder(r.Body).Decode(&classMap); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	classMap["update_user_id"] = claims.UserID

	if err := srv.Db.UpdateProgramClasses(r.Context(), classIDs, classMap); err != nil {
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
