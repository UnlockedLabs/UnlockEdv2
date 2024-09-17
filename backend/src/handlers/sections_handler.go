package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerSectionsRoutes() {
	srv.Mux.Handle("GET /api/programs/{id}/sections", srv.applyMiddleware(srv.handleGetSectionsForProgram))
	srv.Mux.Handle("GET /api/program-sections/{id}", srv.applyMiddleware(srv.handleGetSection))
	srv.Mux.Handle("GET /api/program-sections", srv.applyMiddleware(srv.handleIndexSectionsForFacility))
	srv.Mux.Handle("POST /api/programs/{id}/sections", srv.applyAdminMiddleware(srv.handleCreateSection))
	srv.Mux.Handle("PATCH /api/program-sections/{id}", srv.applyAdminMiddleware(srv.handleUpdateSection))
	srv.Mux.Handle("DELETE /api/program-sections/{id}", srv.applyAdminMiddleware(srv.handleDeleteSection))
}

func (srv *Server) handleGetSectionsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	page, perPage := srv.getPaginationInfo(r)
	total, sections, err := srv.Db.GetSectionsForProgram(id, page, perPage)
	if err != nil {
		log.add("programId", id)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, sections, paginationData)
}

func (srv *Server) handleGetSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("section_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section ID")
	}
	section, err := srv.Db.GetSectionByID(id)
	if err != nil {
		log.add("sectionId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, section)
}

func (srv *Server) handleIndexSectionsForFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	log.add("facility_id", facilityID)
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	log.add("search", search)
	total, sections, err := srv.Db.GetSectionsForFacility(page, perPage, facilityID, search)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, sections, paginationData)
}

func (srv *Server) handleCreateSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	var section models.ProgramSection
	err := json.NewDecoder(r.Body).Decode(&section)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	newSection, err := srv.Db.CreateProgramSection(&section)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, newSection)
}

func (srv *Server) handleDeleteSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("section_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section ID")
	}
	err = srv.Db.DeleteProgramSection(id)
	if err != nil {
		log.add("section_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Section deleted successfully")
}

func (srv *Server) handleUpdateSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section ID")
	}
	defer r.Body.Close()
	section := models.ProgramSection{}
	if err := json.NewDecoder(r.Body).Decode(&section); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	updated, err := srv.Db.UpdateProgramSection(&section, id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}
