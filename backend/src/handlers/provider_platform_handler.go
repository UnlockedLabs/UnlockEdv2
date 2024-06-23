package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderPlatformRoutes() {
	srv.Mux.Handle("GET /api/provider-platforms", srv.applyMiddleware(http.HandlerFunc(srv.HandleIndexProviders)))
	srv.Mux.Handle("GET /api/provider-platforms/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowProvider)))
	srv.Mux.Handle("POST /api/provider-platforms", srv.applyMiddleware(http.HandlerFunc(srv.HandleCreateProvider)))
	srv.Mux.Handle("PATCH /api/provider-platforms/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleUpdateProvider)))
	srv.Mux.Handle("DELETE /api/provider-platforms/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleDeleteProvider)))
}

func (srv *Server) HandleIndexProviders(w http.ResponseWriter, r *http.Request) {
	log.Info("Handling provider index request")
	logFields := log.Fields{
		"handler": "HandleIndexProviders",
		"route":   "GET /api/provider-platforms",
	}
	page, perPage := srv.GetPaginationInfo(r)
	total, platforms, err := srv.Db.GetAllProviderPlatforms(page, perPage)
	if err != nil {
		logFields["databaseMethod"] = "GetAllProviderPlatforms"
		log.WithFields(logFields).Errorf("Error getting provider platforms: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.ProviderPlatform]{
		Data: platforms,
		Meta: paginationData,
	}
	log.Info("Found "+strconv.Itoa(int(total)), " provider platforms")
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleShowProvider(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleShowProvider",
		"route":   "GET /api/provider-platforms/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting provider id from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	logFields["providerId"] = id
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		logFields["databaseMethod"] = "GetProviderPlatformByID"
		log.WithFields(logFields).Errorf("Error getting provider platform: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := models.Resource[models.ProviderPlatform]{
		Data: make([]models.ProviderPlatform, 0),
	}
	response.Data = append(response.Data, *platform)
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var platform models.ProviderPlatform
	logFields := log.Fields{
		"handler": "HandleCreateProvider",
		"route":   "POST /api/provider-platforms",
	}
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newProv, err := srv.Db.CreateProviderPlatform(&platform)
	if err != nil {
		logFields["databaseMethod"] = "CreateProviderPlatform"
		log.WithFields(logFields).Errorf("Error creating provider platform: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.ProviderPlatform]{
		Data:    make([]models.ProviderPlatform, 0),
		Message: "Provider platform created successfully",
	}
	response.Data = append(response.Data, *newProv)
	if err = srv.WriteResponse(w, http.StatusOK, &response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

func (srv *Server) HandleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUpdateProvider",
		"route":   "PATCH /api/provider-platforms/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Error("Error getting provider id from URL: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["providerId"] = id
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		log.WithFields(logFields).Error("Error decoding request body: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	updated, err := srv.Db.UpdateProviderPlatform(&platform, uint(id))
	if err != nil {
		logFields["databaseMethod"] = "UpdateProviderPlatform"
		log.WithFields(logFields).Error("Error updating provider platform: ", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.ProviderPlatform]{
		Data: make([]models.ProviderPlatform, 0),
	}
	response.Data = append(response.Data, *updated)
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Error("Error writing response: ", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleDeleteProvider",
		"route":   "DELETE /api/provider-platforms/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Error("Error getting provider id from URL: ", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["providerId"] = id
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		logFields["databaseMethod"] = "DeleteProviderPlatform"
		log.WithFields(logFields).Error("Error deleting provider platform: ", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
