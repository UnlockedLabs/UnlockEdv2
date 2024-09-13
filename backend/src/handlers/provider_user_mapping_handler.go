package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProviderMappingRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/logins", srv.ApplyAdminMiddleware(srv.HandleError(srv.handleGetMappingsForUser)))
	srv.Mux.Handle("POST /api/users/{id}/logins", srv.ApplyAdminMiddleware(srv.HandleError(srv.handleCreateProviderUserMapping)))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/user-accounts/{user_id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.handleCreateProviderUserAccount)))
	srv.Mux.Handle("DELETE /api/users/{userId}/logins/{providerId}", srv.ApplyAdminMiddleware(srv.HandleError(srv.handleDeleteProviderUserMapping)))
}

func (srv *Server) handleGetMappingsForUser(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "handleGetMappingsForUser")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	mappings, err := srv.Db.GetAllProviderMappingsForUser(id)
	if err != nil {
		fields.add("userId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, mappings)
}

func (srv *Server) handleCreateProviderUserMapping(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "handleCreateProviderUserMapping")
	var mapping models.ProviderUserMapping
	err := json.NewDecoder(r.Body).Decode(&mapping)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		fields.add("userId", mapping.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, mapping)
}

func (srv *Server) handleDeleteProviderUserMapping(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "handleDeleteProviderUserMapping")
	userId, err := strconv.Atoi(r.PathValue("userId"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	fields.add("userId", userId)
	providerId, err := strconv.Atoi(r.PathValue("providerId"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider ID")
	}
	err = srv.Db.DeleteProviderUserMappingByUserID(userId, providerId)
	if err != nil {

		fields.add("providerId", providerId)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Mapping deleted successfully")
}
