package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() {
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-users", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportUsers)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportPrograms)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-milestones", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportMilestones)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportActivity)))
}

func (srv *Server) HandleImportUsers(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
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
			ProviderPlatformID: service.ProviderPlatformID,
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
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	content, err := service.GetPrograms()
	if err != nil {
		log.Error("Error getting provider service GetPrograms:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, item := range content {
		prog := models.Program{
			ProviderPlatformID:      uint(service.ProviderPlatformID),
			Name:                    item.Name,
			Description:             item.Description,
			ExternalID:              item.ExternalID,
			ThumbnailURL:            item.ThumbnailURL,
			ExternalURL:             item.ExternalURL,
			Type:                    models.ProgramType(item.Type),
			OutcomeTypes:            models.OutcomeTypes(item.OutcomeTypes),
			TotalProgressMilestones: uint(item.TotalProgressMilestones),
		}
		_, err := srv.Db.CreateProgram(&prog)
		if err != nil {
			log.Error("Error creating content:" + err.Error())
			continue
		}
	}
	if err := srv.WriteResponse(w, http.StatusOK, "Successfully imported courses"); err != nil {
		log.Error("Error writing response:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) HandleImportMilestones(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	programs, userMappings, err := srv.getProgramsAndMappingsForProvider(service.ProviderPlatformID)
	if err != nil {
		log.Errorf("Error getting programs and user mappings for provider: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Printf("Importing milestones")
	for _, program := range programs {
		log.Printf("Program ID: %d", program.ID)
		for _, userMapping := range userMappings {
			log.Printf("User ID: %d", userMapping.UserID)
			milestones, err := service.GetMilestonesForProgramUser(program.ExternalID, userMapping.ExternalUserID)
			if err != nil {
				log.Errorf("Error getting provider service milestones: %v", err)
				continue
			}
			for _, milestone := range milestones {
				ms := models.Milestone{
					ExternalID:  milestone.ExternalID,
					Type:        models.MilestoneType(milestone.Type),
					IsCompleted: milestone.IsCompleted,
					UserID:      userMapping.UserID,
					ProgramID:   program.ID,
				}
				_, err := srv.Db.CreateMilestone(&ms)
				if err != nil {
					log.Errorf("Error creating milestone: %v", err)
					continue
				}
			}
		}
	}
}

func (srv *Server) getProgramsAndMappingsForProvider(providerID uint) ([]models.Program, []models.ProviderUserMapping, error) {
	userMappings, err := srv.Db.GetUserMappingsForProvider(providerID)
	if err != nil {
		log.Errorf("Error getting user mappings for provider: %v", err)
		return nil, nil, err
	}
	programs, err := srv.Db.GetProgramByProviderPlatformID(int(providerID))
	if err != nil {
		log.Errorf("Error getting programs for provider: %v", err)
		return nil, nil, err
	}
	return programs, userMappings, nil
}

func (srv *Server) getService(r *http.Request) (*src.ProviderService, error) {
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return nil, err
	}
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		return nil, err
	}
	return src.GetProviderService(provider)
}

func (srv *Server) HandleImportActivity(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	programs, userMappings, err := srv.getProgramsAndMappingsForProvider(service.ProviderPlatformID)
	if err != nil {
		log.Errorf("Error getting programs and user mappings for provider: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	userMap := make(map[string]uint)
	for _, user := range userMappings {
		userMap[user.ExternalUserID] = user.UserID
		log.Printf("User ID: %d", user.UserID)
	}

	for _, program := range programs {
		log.Printf("Program ID: %d", program.ID)
		activity, err := service.GetActivityForProgram(program.ExternalID)
		if err != nil {
			log.Errorf("Error getting provider service activity: %v", err)
			continue
		}
		for _, act := range activity {
			activity := models.Activity{
				UserID:    userMap[act.ExternalUserID],
				Type:      models.ActivityType(act.Type),
				ProgramID: program.ID,
				TotalTime: uint(act.TotalTime),
			}
			err := srv.Db.CreateActivity(&activity)
			if err != nil {
				log.Errorf("Error creating activity: %v", err)
				continue
			}
		}
	}
}
