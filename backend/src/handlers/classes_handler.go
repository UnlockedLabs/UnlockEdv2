package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
)

func (srv *Server) registerClassesRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/programs/{id}/classes", srv.handleGetClassesForProgram, false, axx},
		{"GET /api/program-classes/{class_id}", srv.handleGetClass, false, axx},
		{"GET /api/program-classes", srv.handleIndexClassesForFacility, false, axx},
		{"GET /api/program-classes/{class_id}/history", srv.handleGetClassHistory, true, axx},
		{"GET /api/program-classes/{class_id}/attendance-flags", srv.handleGetAttendanceFlagsForClass, true, axx},
		{"POST /api/programs/{id}/classes", srv.handleCreateClass, true, axx},
		{"PATCH /api/program-classes", srv.handleUpdateClasses, true, axx},
		{"PATCH /api/program-classes/{class_id}", srv.handleUpdateClass, true, axx},
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
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		return writeJsonResponse(w, http.StatusInternalServerError, "Error retrieving program")
	}
	if !program.IsActive && !srv.isTesting(r) || program.ArchivedAt != nil && !srv.isTesting(r) {
		return writeJsonResponse(w, http.StatusConflict, "Program is inactive or archived unable to create class")
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
	if class.CanUpdateClass() {
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
	updated, err := srv.Db.UpdateProgramClass(&class, id)
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

	if err := srv.Db.UpdateProgramClasses(classIDs, classMap); err != nil {
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
	paginationMeta, pagedHistoryEvents, err := srv.getPagedHistoryEvents(id, "program_classes", &args, log)
	if err != nil {
		return err
	}
	return writePaginatedResponse(w, http.StatusOK, pagedHistoryEvents, paginationMeta)
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

func (srv *Server) getPagedHistoryEvents(id int, tableName string, args *models.QueryContext, log sLog) (models.PaginationMeta, []models.ActivityHistoryResponse, error) {
	var (
		userIDs            []uint
		paginationMeta     models.PaginationMeta
		pagedHistoryEvents []models.ActivityHistoryResponse
	)
	programClassesHistory, err := srv.Db.GetProgramClassesHistory(id, tableName, args)
	if err != nil {
		return paginationMeta, nil, newDatabaseServiceError(err)
	}
	programHistoryEvents := make([]models.ActivityHistoryResponse, 0)
	for _, history := range programClassesHistory {
		historyEvents, userID, err := history.ConvertAndCompare()
		if err != nil {
			log.errorf("error occurred while converting activity history events, error is %v", err)
			continue
		}
		programHistoryEvents = append(programHistoryEvents, historyEvents...)
		if userIDs == nil || !slices.Contains(userIDs, userID) {
			userIDs = append(userIDs, userID)
		}
	}
	if len(userIDs) > 0 {
		users, err := srv.Db.GetUsersByIDs(userIDs, args)
		if err != nil {
			return paginationMeta, nil, newDatabaseServiceError(err)
		}
		for i := range programHistoryEvents {
			index := slices.IndexFunc(users, func(u models.User) bool {
				return u.ID == *programHistoryEvents[i].UserID
			})
			if index != -1 {
				programHistoryEvents[i].AdminUsername = &users[index].Username
			}
		}
	}
	totalHistoryEvents := len(programHistoryEvents)
	if totalHistoryEvents > 0 {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, int64(totalHistoryEvents))
		start := args.CalcOffset()
		end := start + args.PerPage
		end = min(totalHistoryEvents, end)
		pagedHistoryEvents = programHistoryEvents[start:end]
	} else {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, 1)
	}
	if totalHistoryEvents == 0 || (int64(args.Page) == int64(paginationMeta.LastPage) && len(pagedHistoryEvents) < args.PerPage) {
		var (
			createdByDetails models.ActivityHistoryResponse
		)
		switch tableName {
		case "programs":
			createdByDetails, err = srv.Db.GetProgramCreatedAtAndBy(id, args)
			if err != nil {
				return paginationMeta, nil, newDatabaseServiceError(err)
			}
			prog := "program"
			createdByDetails.FieldName = &prog
		case "program_classes":
			createdByDetails, err = srv.Db.GetClassCreatedAtAndBy(id, args)
			if err != nil {
				return paginationMeta, nil, newDatabaseServiceError(err)
			}
			class := "class"
			createdByDetails.FieldName = &class
		default:
			return paginationMeta, nil, newBadRequestServiceError(errors.New("table name not recognized"), fmt.Sprintf("table name %s not recognized", tableName))
		}
		createdByDetails.Action = models.ProgClassHistory
		pagedHistoryEvents = append(pagedHistoryEvents, createdByDetails)
		//count this record only if there are history events
		if totalHistoryEvents > 0 {
			paginationMeta.Total++
		}
	}
	return paginationMeta, pagedHistoryEvents, nil
}

// The complexity of fetching the history can leave us returning an empty record when there is really no
// available history, and the default initialized struct confuses the client, so we check to be sure
// we are actually sending meaningful data so we can send an empty array instead of a bunch of 'null' values
func isSingleEmptyRecord(pagedHistoryEvents []models.ActivityHistoryResponse) bool {
	if len(pagedHistoryEvents) == 1 {
		return pagedHistoryEvents[0].AdminUsername == nil && pagedHistoryEvents[0].UserUsername == nil && pagedHistoryEvents[0].NewValue == nil
	}
	return false
}
