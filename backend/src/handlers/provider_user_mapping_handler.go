package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProviderMappingRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProviderAccess}
	return []routeDef{
		{"GET /api/users/{id}/logins", srv.handleGetMappingsForUser, true, axx},
		{"POST /api/users/{id}/logins", srv.handleCreateProviderUserMapping, true, axx},
		{"POST /api/provider-platforms/{id}/user-accounts/{user_id}", srv.handleCreateProviderUserAccount, true, axx},
		{"DELETE /api/users/{userId}/logins/{providerId}", srv.handleDeleteProviderUserMapping, true, axx},
	}
}

func (srv *Server) handleGetMappingsForUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	mappings, err := srv.Db.GetAllProviderMappingsForUser(id)
	if err != nil {
		log.add("userId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, mappings)
}

func (srv *Server) handleCreateProviderUserMapping(w http.ResponseWriter, r *http.Request, log sLog) error {
	var mapping models.ProviderUserMapping
	err := json.NewDecoder(r.Body).Decode(&mapping)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		log.add("userId", mapping.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, mapping)
}

func (srv *Server) handleDeleteProviderUserMapping(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("userId"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("userId", userId)
	providerId, err := strconv.Atoi(r.PathValue("providerId"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider ID")
	}
	err = srv.Db.DeleteProviderUserMappingByUserID(userId, providerId)
	if err != nil {

		log.add("providerId", providerId)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Mapping deleted successfully")
}
