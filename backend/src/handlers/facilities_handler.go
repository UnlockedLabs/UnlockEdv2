package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerFacilitiesRoutes() {
	srv.Mux.Handle("GET /api/facilities", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleIndexFacilities)))
	srv.Mux.Handle("GET /api/facilities/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleShowFacility)))
	srv.Mux.Handle("POST /api/facilities", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateFacility)))
	srv.Mux.Handle("DELETE /api/facilities/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteFacility)))
	// srv.Mux.Handle("PATCH /api/facilities/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateFacility)))
}

func (srv *Server) HandleIndexFacilities(w http.ResponseWriter, r *http.Request) {
	log.Info("Handling facility index request")
	facilities, err := srv.Db.GetAllFacilities()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Facility]{
		Data: facilities,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleShowFacility(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("GET Provider handler Error: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		log.Error("Error: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := models.Resource[models.Facility]{
		Data: make([]models.Facility, 0),
	}
	response.Data = append(response.Data, *facility)
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleCreateFacility(w http.ResponseWriter, r *http.Request) {
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		log.Error("Error decoding request body: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newFacility, err := srv.Db.CreateFacility(&facility)
	if err != nil {
		log.Error("Error creating facility: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Facility]{
		Data:    make([]models.Facility, 0),
		Message: "Facility created successfully",
	}
	response.Data = append(response.Data, *newFacility)
	if err = srv.WriteResponse(w, http.StatusOK, &response); err != nil {
		log.Error("Error writing response: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

// func (srv *Server) HandleUpdateFacility(w http.ResponseWriter, r *http.Request) {
// 	id, err := strconv.Atoi(r.PathValue("id"))
// 	if err != nil {
// 		log.Error("PATCH Facility handler Error:", err.Error())
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	var facility models.Facility
// 	err = json.NewDecoder(r.Body).Decode(&facility)
// 	if err != nil {
// 		log.Error("Error decoding request body: ", err.Error())
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	defer r.Body.Close()
// 	updated, err := srv.Db.UpdateFacility(&facility, uint(id))
// 	if err != nil {
// 		log.Error("Error updating provider platform: ", err.Error())
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	response := models.Resource[models.Facility]{
// 		Data: make([]models.Facility, 0),
// 	}
// 	response.Data = append(response.Data, *updated)
// 	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 	}
// }

func (srv *Server) HandleDeleteFacility(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("DELETE Provider handler Error: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		log.Error("Error deleting provider platform: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
