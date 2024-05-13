package handlers

import (
	"Go-Prototype/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProviderMappingRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/logins", srv.applyMiddleware(http.HandlerFunc(srv.handleGetMappingsForUser)))
	srv.Mux.Handle("POST /api/users/{id}/logins", srv.applyMiddleware(http.HandlerFunc(srv.handleCreateProviderUserMapping)))
	srv.Mux.Handle("DELETE /api/users/{userId}/logins/{providerId}", srv.applyMiddleware(http.HandlerFunc(srv.handleDeleteProviderUserMapping)))
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
	if err = srv.WriteResponse(w, http.StatusOK, mappings); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
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
	if err = srv.WriteResponse(w, http.StatusCreated, mapping); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
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
	if err = srv.WriteResponse(w, http.StatusNoContent, nil); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
