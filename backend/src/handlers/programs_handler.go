package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramsRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/programs", srv.handleIndexPrograms, false, axx},
		{"GET /api/programs/{id}", srv.handleShowProgram, false, axx},
		{"POST /api/programs", srv.handleCreateProgram, true, axx},
		{"DELETE /api/programs/{id}", srv.handleDeleteProgram, true, axx},
		{"PATCH /api/programs/{id}", srv.handleUpdateProgram, true, axx},
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
		log.add("search", args.Search)
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
	Name        string              `json:"name"`
	Description string              `json:"description"`
	FundingType models.FundingType  `json:"funding_type"`
	CreditType  []models.CreditType `json:"credit_type"`
	IsActive    bool                `json:"is_active"`
	ProgramType []models.ProgType   `json:"program_type"`
	Facilities  []int               `json:"facilities"`
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
		Name:        program.Name,
		Description: program.Description,
		FundingType: program.FundingType,
		IsActive:    program.IsActive,
	}
	var programTypes models.ProgramTypeInfo
	programTypes.ProgramTypes = program.ProgramType
	programTypes.ProgramCreditTypes = program.CreditType
	err = srv.Db.CreateProgram(&newProg, &programTypes)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("program_id", newProg.ID)
	for _, facilityId := range program.Facilities {
		facilityProgram := models.FacilitiesPrograms{
			FacilityID: uint(facilityId),
			ProgramID:  newProg.ID,
		}
		log.add("facility_id", facilityId)
		if err := srv.Db.Model(&models.FacilitiesPrograms{}).Create(&facilityProgram).Error; err != nil {
			log.info("Error creating facility program: " + err.Error())
			continue
		}
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
