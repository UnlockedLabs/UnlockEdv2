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
		{"PATCH /api/program-sections", srv.handleUpdateSection, true, axx},
	}
}

func (srv *Server) handleGetSectionsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	args := srv.getQueryContext(r)
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
	args := srv.getQueryContext(r)
	sections, err := srv.Db.GetSectionsForFacility(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, sections, args.IntoMeta())
}

func (srv *Server) handleCreateSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	var section models.ProgramSection
	err = json.NewDecoder(r.Body).Decode(&section)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	section.FacilityID = claims.FacilityID
	section.ProgramID = uint(id)
	newSection, err := srv.Db.CreateProgramSection(&section)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	//audit new section id and program id
	log.add("program_id", id)
	log.add("section_id", newSection.ID)
	return writeJsonResponse(w, http.StatusCreated, newSection)
}

func (srv *Server) handleUpdateSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	ids := r.URL.Query()["id"]
	sectionIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if sectionID, err := strconv.Atoi(id); err == nil {
			sectionIDs = append(sectionIDs, sectionID)
		}
	}
	defer r.Body.Close()
	section := models.ProgramSection{}
	if err := json.NewDecoder(r.Body).Decode(&section); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	updated, err := srv.Db.UpdateProgramSection(&section, sectionIDs)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}
