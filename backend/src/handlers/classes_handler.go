package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
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
		{"PATCH /api/program-classes/{id}", srv.handleUpdateClass, true, axx},
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
	var class models.ProgramClass
	err = json.NewDecoder(r.Body).Decode(&class)
	defer r.Body.Close()
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
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	class := models.ProgramClass{}
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		return newJSONReqBodyServiceError(err)
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
	defer r.Body.Close()
	classMap := make(map[string]interface{})
	if err := json.NewDecoder(r.Body).Decode(&classMap); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	classMap["update_user_id"] = claims.UserID
	err := srv.Db.UpdateProgramClasses(classMap, classIDs)
	if err != nil {
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
	classHistory, err := srv.Db.GetClassHistory(id, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	classHistoryEvents := make([]models.ActivityHistoryResponse, 0)
	var (
		userIDs            []uint
		paginationMeta     models.PaginationMeta
		pagedHistoryEvents []models.ActivityHistoryResponse
	)
	for _, history := range classHistory {
		historyEvents, userID, err := history.ConvertAndCompare()
		if err != nil {
			log.errorf("error occurred while converting activity history events, error is %v", err)
			continue
		}
		classHistoryEvents = append(classHistoryEvents, historyEvents...)
		if userIDs == nil || !slices.Contains(userIDs, userID) {
			userIDs = append(userIDs, userID)
		}
	}
	if len(userIDs) > 0 {
		users, err := srv.Db.GetUsersByIDs(userIDs, &args)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		for i := range classHistoryEvents {
			index := slices.IndexFunc(users, func(u models.User) bool {
				return u.ID == classHistoryEvents[i].UserID
			})
			if index != -1 {
				classHistoryEvents[i].AdminUsername = &users[index].Username
			}
		}
	}
	totalHistoryEvents := len(classHistoryEvents)
	if totalHistoryEvents > 0 {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, int64(totalHistoryEvents))
		start := args.CalcOffset()
		end := start + args.PerPage
		if end > totalHistoryEvents {
			end = totalHistoryEvents
		}
		pagedHistoryEvents = classHistoryEvents[start:end]
	} else {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, 1)
	}
	if totalHistoryEvents == 0 || (int64(args.Page) == int64(paginationMeta.LastPage) && len(pagedHistoryEvents) < args.PerPage) {
		class, err := srv.Db.GetClassCreatedAtAndBy(id, &args)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		class.Action = models.ClassHistory
		class.FieldName = "class"
		pagedHistoryEvents = append(pagedHistoryEvents, class)
		//count this record only if there are history events
		if totalHistoryEvents > 0 {
			paginationMeta.Total++
		}
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
