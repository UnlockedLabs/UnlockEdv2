package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramsRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/programs", srv.handleIndexPrograms, false, axx},
		{"GET /api/programs/stats", srv.handleIndexProgramsFacilitiesStats, true, axx},
		{"GET /api/programs/detailed-list", srv.handleIndexProgramsOverviewTable, true, axx},
		{"GET /api/programs/{id}", srv.handleShowProgram, false, axx},
		{"GET /api/programs/{id}/history", srv.handleGetProgramHistory, true, axx},
		{"POST /api/programs", srv.handleCreateProgram, true, axx},
		{"DELETE /api/programs/{id}", srv.handleDeleteProgram, true, axx},
		{"PATCH /api/programs/{id}", srv.handleUpdateProgram, true, axx},
		{"PATCH /api/programs/{id}/status", srv.handleUpdateProgramStatus, true, axx},
		{"PUT /api/programs/{id}/save", srv.handleFavoriteProgram, false, axx},
	}
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) handleIndexPrograms(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	programs, err := srv.Db.GetPrograms(&args)
	if err != nil {
		log.add("search_query", args.Search)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, programs, args.IntoMeta())
}

type ProgramOverviewResponse struct {
	models.Program
	ActiveEnrollments      int     `json:"active_enrollments"`
	Completions            int     `json:"completions"`
	TotalEnrollments       int     `json:"total_enrollments"`
	CompletionRate         float64 `json:"completion_rate"`
	ActiveClassFacilityIDs []int   `json:"active_class_facility_ids"`
}

func (srv *Server) handleIndexProgramsFacilitiesStats(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	adminRole := r.Context().Value(ClaimsKey).(*Claims).Role
	timeFilter, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil {
		timeFilter = -1
	}
	var programs models.ProgramsFacilitiesStats
	if adminRole == models.FacilityAdmin {
		programs, err = srv.Db.GetProgramsFacilityStats(&args, timeFilter)
	} else {
		programs, err = srv.Db.GetProgramsFacilitiesStats(&args, timeFilter)
	}
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, programs)
}

func (srv *Server) handleIndexProgramsOverviewTable(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	adminRole := r.Context().Value(ClaimsKey).(*Claims).Role
	timeFilter, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil {
		timeFilter = -1
	}
	includeArchived := r.URL.Query().Get("include_archived") == "true"
	programs, err := srv.Db.GetProgramsOverviewTable(&args, timeFilter, includeArchived, adminRole)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, programs, args.IntoMeta())
}

func (srv *Server) handleShowProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}

	claims := r.Context().Value(ClaimsKey).(*Claims)
	facility_id := claims.FacilityID

	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}

	metrics, err := srv.Db.FetchEnrollmentMetrics(id, facility_id)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}

	activeClassFacilityIDs, err := srv.Db.GetActiveClassFacilityIDs(r.Context(), id)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}

	resultSet := ProgramOverviewResponse{
		Program:                *program,
		ActiveEnrollments:      metrics.ActiveEnrollments,
		Completions:            metrics.Completions,
		TotalEnrollments:       metrics.TotalEnrollments,
		CompletionRate:         metrics.CompletionRate,
		ActiveClassFacilityIDs: activeClassFacilityIDs,
	}

	return writeJsonResponse(w, http.StatusOK, resultSet)
}

type ProgramForm struct {
	Name         string                     `json:"name"`
	Description  string                     `json:"description"`
	FundingType  models.FundingType         `json:"funding_type"`
	CreditTypes  []models.ProgramCreditType `json:"credit_types"`
	IsActive     bool                       `json:"is_active"`
	ProgramTypes []models.ProgramType       `json:"program_types"`
	Facilities   []int                      `json:"facilities"`
}

func (srv *Server) handleCreateProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var program ProgramForm
	err := json.NewDecoder(r.Body).Decode(&program)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if len(program.Facilities) == 0 {
		program.Facilities = []int{int(claims.FacilityID)}
	}

	newProg := models.Program{
		Name:               program.Name,
		Description:        program.Description,
		FundingType:        program.FundingType,
		IsActive:           program.IsActive,
		CreateUserID:       claims.UserID,
		ProgramTypes:       program.ProgramTypes,
		ProgramCreditTypes: program.CreditTypes,
	}

	err = srv.Db.CreateProgram(&newProg)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("program_id", newProg.ID)
	facilityPrograms := src.IterMap(func(id int) models.FacilitiesPrograms {
		return models.FacilitiesPrograms{
			FacilityID: uint(id),
			ProgramID:  newProg.ID,
		}
	}, program.Facilities)
	if err := srv.Db.Model(&models.FacilitiesPrograms{}).Create(&facilityPrograms).Error; err != nil {
		log.info("Error creating facility program: " + err.Error())
	}
	return writeJsonResponse(w, http.StatusCreated, newProg)
}

func (srv *Server) handleUpdateProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var programForm ProgramForm
	err := json.NewDecoder(r.Body).Decode(&programForm)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	programID := uint(id)
	theProg := models.Program{
		DatabaseFields: models.DatabaseFields{
			ID: programID,
		},
		Name:               programForm.Name,
		Description:        programForm.Description,
		FundingType:        programForm.FundingType,
		IsActive:           programForm.IsActive,
		UpdateUserID:       claims.UserID,
		ProgramTypes:       programForm.ProgramTypes,
		ProgramCreditTypes: programForm.CreditTypes,
	}

	updated, updateErr := srv.Db.UpdateProgram(r.Context(), &theProg, programForm.Facilities)
	if updateErr != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleUpdateProgramStatus(w http.ResponseWriter, r *http.Request, log sLog) error {
	programUpdate := make(map[string]any)
	if err := json.NewDecoder(r.Body).Decode(&programUpdate); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	// These will need to be uncommented once the update_user_id is added to the database
	claims := r.Context().Value(ClaimsKey).(*Claims)
	programUpdate["update_user_id"] = claims.UserID
	facilities, updated, err := srv.Db.UpdateProgramStatus(r.Context(), programUpdate, uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	payload := struct {
		Updated    bool     `json:"updated"`
		Facilities []string `json:"facilities"`
		Message    string   `json:"message"`
	}{
		Updated:    updated,
		Facilities: facilities,
	}

	if updated {
		payload.Message = "Program status updated successfully"
	} else {
		payload.Message = "Unable to archive program with active or scheduled classes"
	}

	return writeJsonResponse(w, http.StatusOK, payload)
}

func (srv *Server) handleDeleteProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	if err = srv.Db.DeleteProgram(id); err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("Program deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Program deleted successfully")
}

func (srv *Server) handleFavoriteProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	user_id := srv.getUserID(r)
	favoriteRemoved, err := srv.Db.ToggleProgramFavorite(user_id, uint(id))
	if err != nil {
		log.add("program_id", id)
		log.add("user_id", user_id)
		return newDatabaseServiceError(err)
	}
	log.debugf("Favorite removed: %v", favoriteRemoved)
	if favoriteRemoved {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}

func (srv *Server) handleGetProgramHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryContext(r)
	historyEvents, err := srv.Db.GetChangeLogEntries(&args, "programs", id)
	if err != nil {
		return err
	}

	pageMeta := args.IntoMeta()
	if args.Total == 0 || (int64(args.Page) == int64(pageMeta.LastPage) && len(historyEvents) < args.PerPage) { //add get program created by here
		var (
			createdByDetails models.ActivityHistoryResponse
		)
		createdByDetails, err = srv.Db.GetProgramCreatedAtAndBy(id, &args)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		createdByDetails.FieldName = models.StringPtr("program")
		createdByDetails.Action = models.ProgClassHistory
		historyEvents = append(historyEvents, createdByDetails)
		//count this record only if there are history events
		if args.Total > 0 {
			pageMeta.Total++
		}
	}
	return writePaginatedResponse(w, http.StatusOK, historyEvents, pageMeta)
}
