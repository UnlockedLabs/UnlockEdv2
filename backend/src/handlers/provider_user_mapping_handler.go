package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderMappingRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/logins", srv.applyMiddleware(http.HandlerFunc(srv.handleGetMappingsForUser)))
	srv.Mux.Handle("POST /api/users/{id}/logins", srv.applyMiddleware(http.HandlerFunc(srv.handleCreateProviderUserMapping)))
	srv.Mux.Handle("DELETE /api/users/{userId}/logins/{providerId}", srv.applyMiddleware(http.HandlerFunc(srv.handleDeleteProviderUserMapping)))
}

func (srv *Server) handleGetMappingsForUser(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "handleGetMappingsForUser",
		"route":   "GET /api/users/{id}/logins",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Error("Error getting user id from URL: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	logFields["userId"] = id
	mappings, err := srv.Db.GetAllProviderMappingsForUser(id)
	if err != nil {
		logFields["databaseMethod"] = "GetAllProviderMappingsForUser"
		log.WithFields(logFields).Error("Error getting provider mappings: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		delete(logFields, "databaseMethod")
	}
	if err = srv.WriteResponse(w, http.StatusOK, mappings); err != nil {
		log.WithFields(logFields).Error("Error writing response: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) handleCreateProviderUserMapping(w http.ResponseWriter, r *http.Request) {
	var mapping models.ProviderUserMapping
	logFields := log.Fields{
		"handler": "handleCreateProviderUserMapping",
		"route":   "POST /api/users/{id}/logins",
	}
	err := json.NewDecoder(r.Body).Decode(&mapping)
	defer r.Body.Close()
	if err != nil {
		log.WithFields(logFields).Error("Error decoding request body: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		logFields["databaseMethod"] = "CreateProviderUserMapping"
		log.WithFields(logFields).Error("Error creating provider user mapping: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err = srv.WriteResponse(w, http.StatusCreated, mapping); err != nil {
		log.WithFields(logFields).Error("Error writing response: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) handleDeleteProviderUserMapping(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "handleDeleteProviderUserMapping",
		"route":   "DELETE /api/users/{userId}/logins/{providerId}",
	}
	userId, err := strconv.Atoi(r.PathValue("userId"))
	if err != nil {
		log.WithFields(logFields).Error("Error getting user id from URL: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid mapping id")
		return
	}
	logFields["userId"] = userId
	providerId, err := strconv.Atoi(r.PathValue("providerId"))
	if err != nil {
		log.WithFields(logFields).Error("Error getting provider id from URL: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid mapping id")
	}
	logFields["providerId"] = providerId
	err = srv.Db.DeleteProviderUserMappingByUserID(userId, providerId)
	if err != nil {
		logFields["databaseMethod"] = "DeleteProviderUserMappingByUserID"
		log.WithFields(logFields).Error("Error deleting provider user mapping: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err = srv.WriteResponse(w, http.StatusNoContent, nil); err != nil {
		log.WithFields(logFields).Error("Error writing response: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
