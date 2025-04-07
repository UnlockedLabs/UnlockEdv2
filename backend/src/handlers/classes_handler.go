package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerClassesRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/programs/{id}/classes", srv.handleGetClassesForProgram, false, axx},
		{"GET /api/programs/{id}/classes/{class_id}", srv.handleGetClass, false, axx},
		{"POST /api/programs/{id}/classes", srv.handleCreateClass, true, axx},
		{"PATCH /api/programs/{id}/classes/{c_id}", srv.handleUpdateClass, true, axx},
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
	class.ProgramID = uint(id)
	newClass, err := srv.Db.CreateProgramClass(&class)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	//audit new class id and program id
	log.add("program_id", id)
	log.add("class_id", newClass.ID)
	return writeJsonResponse(w, http.StatusCreated, newClass)
}

func (srv *Server) handleUpdateClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	ids := r.URL.Query()["id"]
	classIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if classID, err := strconv.Atoi(id); err == nil {
			classIDs = append(classIDs, classID)
		}
	}
	defer r.Body.Close()
	class := models.ProgramClass{}
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	updated, err := srv.Db.UpdateProgramClass(&class, classIDs)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}
