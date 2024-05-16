package handlers

import (
	"Go-Prototype/src"
	cmd "Go-Prototype/src"
	"Go-Prototype/src/models"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() {
	srv.Mux.Handle("POST /actions/provider-platforms/{id}/import-users", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportUsers)))
	srv.Mux.Handle("POST /actions/provider-platforms/{id}/import-programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportPrograms)))
	srv.Mux.Handle("POST /actions/provider-platforms/{id}/import-milestones", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportMilestones)))
}

func (srv *Server) HandleImportUsers(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		log.Error("Error getting provider platform by ID:" + err.Error())
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	service, err := cmd.GetProviderService(provider)
	if err != nil {
		log.Error("Error getting provider service GetProviderService():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	users, err := service.GetUsers()
	if err != nil {
		log.Error("Error getting provider service GetUsers():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, user := range users {
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			continue
		}
		newUser := models.User{
			Username:  user.Username,
			Email:     user.Email,
			NameFirst: user.NameFirst,
			NameLast:  user.NameLast,
		}
		created, err := srv.Db.CreateUser(&newUser)
		if err != nil {
			log.Error("Error creating user:" + err.Error())
			continue
		}
		mapping := models.ProviderUserMapping{
			UserID:             created.ID,
			ProviderPlatformID: provider.ID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
			ExternalLoginID:    user.ExternalUsername,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) HandleImportPrograms(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	service, err := cmd.GetProviderService(provider)
	if err != nil {
		log.Error("Error getting provider service GetProviderService:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	content, err := service.GetPrograms()
	if err != nil {
		log.Error("Error getting provider service GetPrograms:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, item := range content {
		if item.Name == "" && item.Description == "" {
			continue
		}
		_, err := srv.Db.CreateProgram(&item)
		if err != nil {
			log.Error("Error creating content:" + err.Error())
			continue
		}
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, "Successfully imported courses"); err != nil {
		log.Error("Error writing response:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) HandleImportMilestones(w http.ResponseWriter, r *http.Request) {
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		log.Errorf("Error getting provider platform by ID: %v", err)
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	service, err := src.GetProviderService(provider)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	userMappings, err := srv.Db.GetUserMappingsForProvider(provider.ID)
	if err != nil {
		log.Errorf("Error getting user mappings for provider: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	programs, err := srv.Db.GetProgramByProviderPlatformID(int(provider.ID))
	if err != nil {
		log.Errorf("Error getting programs for provider: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, program := range programs {
		for _, userMapping := range userMappings {
			milestones, err := service.GetMilestonesForProgramUser(program.ExternalID, userMapping.ExternalUserID)
			if err != nil {
				log.Errorf("Error getting provider service milestones: %v", err)
				continue
			}
			for _, milestone := range milestones {
				_, err := srv.Db.CreateMilestone(&milestone)
				if err != nil {
					log.Errorf("Error creating milestone: %v", err)
					continue
				}
			}
		}
	}
}
