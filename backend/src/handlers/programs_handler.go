package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.applyMiddleware(srv.handleIndexPrograms))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(srv.handleShowProgram))
	srv.Mux.Handle("POST /api/programs", srv.applyAdminMiddleware(srv.handleCreateProgram))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.applyAdminMiddleware(srv.handleDeleteProgram))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.applyAdminMiddleware(srv.handleUpdateProgram))
	srv.Mux.Handle("PUT /api/programs/{id}/save", srv.applyMiddleware(srv.handleFavoriteProgram))
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
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	tags := r.URL.Query()["tags"]
	var tagsSplit []string
	if len(tags) > 0 {
		tagsSplit = strings.Split(tags[0], ",")
	}
	total, programs, err := srv.Db.GetProgram(page, perPage, tagsSplit, search)
	if err != nil {
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, programs, paginationData)
}

func (srv *Server) handleShowProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.add("programId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, program)
}

type ProgramForm struct {
	// ... program
	Name          string `json:"name"`
	Description   string `json:"description"`
	CreditType    string `json:"credit_type"`
	ProgramStatus string `json:"program_status"`
	ProgramType   string `json:"program_type"`
	Facilities    []int  `json:"facilities"`
}

func (srv *Server) handleCreateProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	var program ProgramForm
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	newProg := models.Program{
		Name:          program.Name,
		Description:   program.Description,
		CreditType:    program.CreditType,
		ProgramStatus: program.ProgramStatus,
		ProgramType:   program.ProgramType,
	}
	err = srv.Db.CreateProgram(&newProg)
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
		if err := srv.Db.Create(&facilityProgram).Error; err != nil {
			log.info("Error creating facility program: " + err.Error())
			continue
		}
	}
	return writeJsonResponse(w, http.StatusCreated, "Program created successfully")
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
	log.add("programId", id)
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
	log.add("programID", id)
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
	user_id := srv.userIdFromRequest(r)
	favoriteRemoved, err := srv.Db.ToggleUserFavorite(user_id, uint(id))
	if err != nil {
		log.add("programId", id)
		log.add("userId", user_id)
		return newDatabaseServiceError(err)
	}
	log.debugf("Favorite removed: %v", favoriteRemoved)
	if favoriteRemoved {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}
