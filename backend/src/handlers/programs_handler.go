package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (srv *Server) registerProgramsRoutes() []routeDef {
	axx := models.ProgramAccess
	return []routeDef{
		featureRoute("GET /api/programs", srv.handleIndexPrograms, axx),
		featureRoute("GET /api/programs/filters", srv.handleGetProgramFilters, axx),
		featureRoute("GET /api/programs/{id}", srv.handleShowProgram, axx),
		/* admin */
		adminFeatureRoute("GET /api/programs/detailed-list", srv.handleIndexProgramsOverviewTable, axx),
		adminFeatureRoute("GET /api/programs/stats", srv.handleIndexProgramsFacilitiesStats, axx),
		adminFeatureRoute("GET /api/programs/{id}/history", srv.handleGetProgramHistory, axx),
		adminFeatureRoute("POST /api/programs", srv.handleCreateProgram, axx),
		adminFeatureRoute("DELETE /api/programs/{id}", srv.handleDeleteProgram, axx),
		adminFeatureRoute("PATCH /api/programs/{id}/status", srv.handleUpdateProgramStatus, axx),
		adminFeatureRoute("PATCH /api/programs/{id}", srv.handleUpdateProgram, axx),
		adminValidatedFeatureRoute("GET /api/programs/csv", srv.handleExportProgramCSV, axx, enforceDeptAdminForAllQuery),
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
	filters := make(map[string]string, 11)
	for key, values := range r.URL.Query() {
		if strings.HasPrefix(key, "filter_") && len(values) > 0 {
			filters[strings.TrimPrefix(key, "filter_")] = values[0]
		}
	}
	programs, err := srv.Db.GetProgramsOverviewTable(&args, timeFilter, includeArchived, adminRole, filters)
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

	overview, err := srv.Db.FetchEnrollmentMetrics(id, facility_id)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}

	activeClassFacilityIDs, err := srv.Db.GetActiveClassFacilityIDs(r.Context(), id)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}
	overview.Program = *program
	overview.ActiveClassFacilityIDs = activeClassFacilityIDs
	return writeJsonResponse(w, http.StatusOK, overview)
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

func (srv *Server) handleGetProgramHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryContext(r)
	categories := r.URL.Query()["categories"]
	historyEvents, err := srv.Db.GetChangeLogEntries(&args, "programs", id, categories)
	if err != nil {
		return err
	}
	pageMeta, createdByDetails, err := srv.getCreatedByForHistory(id, "programs", args.IntoMeta(), &args, len(historyEvents), categories)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	historyEvents = append(historyEvents, createdByDetails)
	return writePaginatedResponse(w, http.StatusOK, historyEvents, pageMeta)
}

func (srv *Server) getCreatedByForHistory(id int, tableName string, pageMeta models.PaginationMeta, args *models.QueryContext, numOfHistoryEvents int, categories []string) (models.PaginationMeta, models.ActivityHistoryResponse, error) {
	var (
		createdByDetails models.ActivityHistoryResponse
		err              error
	)
	if int(args.Total) == args.PerPage {
		pageMeta.LastPage++
		pageMeta.Total++
	}
	if (args.Total == 0 || (int64(args.Page) == int64(pageMeta.LastPage) && numOfHistoryEvents < args.PerPage)) && (len(categories) == 0 || srv.containsCategory(categories, "info")) { //add get class created by here
		switch tableName {
		case "programs":
			createdByDetails, err = srv.Db.GetProgramCreatedAtAndBy(id, args)
			if err != nil {
				return pageMeta, createdByDetails, newDatabaseServiceError(err)
			}
			prog := "program"
			createdByDetails.FieldName = &prog
		case "program_classes":
			createdByDetails, err = srv.Db.GetClassCreatedAtAndBy(id, args)
			if err != nil {
				return pageMeta, createdByDetails, newDatabaseServiceError(err)
			}
			class := "class"
			createdByDetails.FieldName = &class
		default:
			return pageMeta, createdByDetails, newBadRequestServiceError(errors.New("table name not recognized"), fmt.Sprintf("table name %s not recognized", tableName))
		}
		createdByDetails.Action = models.ProgClassHistory
		//count this record only if there are history events
		if args.Total > 0 {
			pageMeta.Total++
		}
	}
	return pageMeta, createdByDetails, nil
}

func (srv *Server) handleExportProgramCSV(w http.ResponseWriter, r *http.Request, log sLog) error {
	queryCtx := srv.getQueryContext(r)
	csvData, err := srv.Db.GetProgramsCSVData(&queryCtx)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	toCSV, err := models.ProgramDataToCSVFormat(csvData)
	if err != nil {
		return newInternalServerServiceError(err, "Failed to convert program data to CSV format")
	}
	date := time.Now().Format("2006-01-02")
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"Program-Data-%s.csv\"", date))
	w.WriteHeader(http.StatusOK)
	writer := csv.NewWriter(w)

	writeErr := writer.WriteAll(toCSV)
	if writeErr != nil {
		return newInternalServerServiceError(writeErr, "Failed to write CSV data")
	}
	return nil
}

func (srv *Server) handleGetProgramFilters(w http.ResponseWriter, r *http.Request, log sLog) error {
	type EnumResponse struct {
		FundingTypes []models.FundingType `json:"funding_types"`
		ProgramTypes []models.ProgType    `json:"program_types"`
		CreditTypes  []models.CreditType  `json:"credit_types"`
	}
	resp := EnumResponse{
		FundingTypes: models.AllFundingTypes,
		ProgramTypes: models.AllProgTypes,
		CreditTypes:  models.AllCreditTypes,
	}
	return writeJsonResponse(w, http.StatusOK, resp)
}

func (srv *Server) containsCategory(categories []string, target string) bool {
	for _, category := range categories {
		if category == target {
			return true
		}
	}
	return false
}
