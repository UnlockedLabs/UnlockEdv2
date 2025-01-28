package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerSectionsRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/programs/{id}/sections", srv.handleGetSectionsForProgram, false, axx},
		{"GET /api/program-sections/{section_id}", srv.handleGetSection, false, axx},
		{"GET /api/program-sections", srv.handleIndexSectionsForFacility, false, axx},
		{"POST /api/programs/{id}/sections", srv.handleCreateSection, true, axx},
		{"PATCH /api/program-sections/{id}", srv.handleUpdateSection, true, axx},
		{"DELETE /api/program-sections/{section_id}", srv.handleDeleteSection, true, axx},
	}
}

func (srv *Server) handleGetSectionsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryArgs(r)
	sections, err := srv.Db.GetSectionsForProgram(id, &args)
	if err != nil {
		log.add("program_id", id)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, sections, args.IntoMeta())
}

func (srv *Server) handleGetSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("section_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section ID")
	}
	section, err := srv.Db.GetSectionByID(id)
	if err != nil {
		log.add("section_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, section)
}

func (srv *Server) handleIndexSectionsForFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryArgs(r)
	sections, err := srv.Db.GetSectionsForFacility(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, sections, args.IntoMeta())
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
	return writeJsonResponse(w, http.StatusNoContent, "Section deleted successfully")
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
