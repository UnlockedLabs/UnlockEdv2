package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/go-co-op/gocron/v2"
)

func (srv *Server) registerProgramsRoutes() []routeDef {
	axx := models.ProgramAccess
	return []routeDef{
		featureRoute("GET /api/programs", srv.handleIndexPrograms, axx),
		featureRoute("GET /api/programs/{id}", srv.handleShowProgram, axx),
		featureRoute("PUT /api/programs/{id}/save", srv.handleFavoriteProgram, axx),
		/* admin */
		adminFeatureRoute("GET /api/programs/detailed-list", srv.handleIndexProgramsOverviewTable, axx),
		adminFeatureRoute("GET /api/programs/stats", srv.handleIndexProgramsFacilitiesStats, axx),
		adminFeatureRoute("GET /api/programs/stats/lastRun", srv.handleGetProgramOverviewLastUpdatedAt, axx),
		adminFeatureRoute("GET /api/programs/{id}/history", srv.handleGetProgramHistory, axx),
		adminFeatureRoute("POST /api/programs", srv.handleCreateProgram, axx),
		adminFeatureRoute("DELETE /api/programs/{id}", srv.handleDeleteProgram, axx),
		adminFeatureRoute("PATCH /api/programs/{id}/status", srv.handleUpdateProgramStatus, axx),
		adminFeatureRoute("PATCH /api/programs/{id}", srv.handleUpdateProgram, axx),
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

func (srv *Server) handleGetProgramOverviewLastUpdatedAt(w http.ResponseWriter, r *http.Request, log sLog) error {
	lastUpatedAt, err := srv.Db.GetProgramOverviewLastUpdatedAt(r.Context())
	if err != nil {
		return newDatabaseServiceError(err)
	}

	cronExpression := os.Getenv("MIDDLEWARE_CRON_SCHEDULE")
	if cronExpression != "" { //parsing the cron expression used by program overview
		scheduler, err := gocron.NewScheduler()
		if err != nil {
			return newBadRequestServiceError(err, "unable to create cron scheduler used for parsing cron schedule")
		}
		job, err := scheduler.NewJob(gocron.CronJob(cronExpression, false), gocron.NewTask(func() {}))
		if err != nil {
			return newBadRequestServiceError(err, "unable to create new generic job using the cron schedule: "+cronExpression)
		}
		next, err := job.NextRun()
		if err != nil {
			return newBadRequestServiceError(err, "unble to get the next run of job")
		}
		lastUpatedAt.LastRanTime = next.Format("3:04 PM")
	}
	return writeJsonResponse(w, http.StatusOK, lastUpatedAt)
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
	pageMeta, createdByDetails, err := srv.getCreatedByForHistory(id, "programs", args.IntoMeta(), &args, len(historyEvents))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	historyEvents = append(historyEvents, createdByDetails)
	return writePaginatedResponse(w, http.StatusOK, historyEvents, pageMeta)
}

func (srv *Server) getCreatedByForHistory(id int, tableName string, pageMeta models.PaginationMeta, args *models.QueryContext, numOfHistoryEvents int) (models.PaginationMeta, models.ActivityHistoryResponse, error) {
	var (
		createdByDetails models.ActivityHistoryResponse
		err              error
	)
	if int(args.Total) == args.PerPage {
		pageMeta.LastPage++
		pageMeta.Total++
	}
	if args.Total == 0 || (int64(args.Page) == int64(pageMeta.LastPage) && numOfHistoryEvents < args.PerPage) { //add get class created by here
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
