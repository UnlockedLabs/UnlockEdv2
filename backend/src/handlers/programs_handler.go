package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
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
	ActiveEnrollments int     `json:"active_enrollments"`
	Completions       int     `json:"completions"`
	TotalEnrollments  int     `json:"total_enrollments"`
	CompletionRate    float64 `json:"completion_rate"`
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
	resultSet := ProgramOverviewResponse{
		Program:           *program,
		ActiveEnrollments: metrics.ActiveEnrollments,
		Completions:       metrics.Completions,
		TotalEnrollments:  metrics.TotalEnrollments,
		CompletionRate:    metrics.CompletionRate,
	}

	return writeJsonResponse(w, http.StatusOK, resultSet)
}

type ProgramForm struct {
	// ... program
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
	defer r.Body.Close()
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
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.error("Error getting program:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
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
	defer r.Body.Close()
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	// These will need to be uncommented once the update_user_id is added to the database
	//claims := r.Context().Value(ClaimsKey).(*Claims)
	//programUpdate["update_user_id"] = claims.UserID
	facilities, updated, err := srv.Db.UpdateProgramStatus(programUpdate, uint(id))
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
	paginationMeta, pagedHistoryEvents, err := srv.getPagedHistoryEvents(id, "programs", &args, log)
	if err != nil {
		return err
	}
	if isSingleEmptyRecord(pagedHistoryEvents) {
		pagedHistoryEvents = []models.ActivityHistoryResponse{}
		paginationMeta.Total = 0
	}
	return writePaginatedResponse(w, http.StatusOK, pagedHistoryEvents, paginationMeta)
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
