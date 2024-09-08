package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProviderMappingRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/logins", srv.ApplyAdminMiddleware(srv.handleGetMappingsForUser))
	srv.Mux.Handle("POST /api/users/{id}/logins", srv.ApplyAdminMiddleware(srv.handleCreateProviderUserMapping))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/user-accounts/{user_id}", srv.ApplyAdminMiddleware(srv.handleCreateProviderUserAccount))
	srv.Mux.Handle("DELETE /api/users/{userId}/logins/{providerId}", srv.ApplyAdminMiddleware(srv.handleDeleteProviderUserMapping))
}

func (srv *Server) handleGetMappingsForUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	mappings, err := srv.Db.GetAllProviderMappingsForUser(id)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
	writeJsonResponse(w, http.StatusOK, mappings)
}

func (srv *Server) handleCreateProviderUserMapping(w http.ResponseWriter, r *http.Request) {
	var mapping models.ProviderUserMapping
	err := json.NewDecoder(r.Body).Decode(&mapping)
	defer r.Body.Close()
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusCreated, mapping)
}

func (srv *Server) handleDeleteProviderUserMapping(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("userId"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid mapping id")
		return
	}
	providerId, err := strconv.Atoi(r.PathValue("providerId"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid mapping id")
	}
	err = srv.Db.DeleteProviderUserMappingByUserID(userId, providerId)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusNoContent, "Mapping deleted successfully")
}
