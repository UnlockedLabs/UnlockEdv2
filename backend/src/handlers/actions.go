package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() {
	srv.Mux.Handle("GET /api/actions/provider-platforms/{id}/get-users", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetUsers)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-users", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportUsers)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportPrograms)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-milestones", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportMilestones)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleImportActivity)))
}

type CachedProviderUsers struct {
	Users       []models.ImportUser
	LastUpdated time.Time
}

var cachedProviderUsers = make(map[uint]CachedProviderUsers)

func (srv *Server) HandleImportUsers(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	users, err := service.GetUsers()
	if err != nil {
		log.Error("Error getting provider service GetUsers action:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	if err != nil {
		log.Errorf("Error getting provider platform by id: %v", err)
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
		if !srv.isTesting(r) {
			if err := srv.handleCreateUserKratos(created.Username, created.Password); err != nil {
				log.Printf("Error creating user in kratos: %v", err)
				// FIXME: Error handling if we fail
			}
		}
		mapping := models.ProviderUserMapping{
			UserID:             created.ID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		if provider.OidcID != 0 {
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.Errorln("Error registering provider login", err)
			}
		}
	}
	if err := srv.Db.RegisterImportingAllProviderUsers(provider.ID); err != nil {
		log.Errorf("Error registering all provider users imported: %v", err)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// Here we get all the users from a Provider and send them to the client to be
// mapped or imported into our system
func (srv *Server) HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if users, ok := cachedProviderUsers[uint(service.ProviderPlatformID)]; ok {
		if users.LastUpdated.Add(24 * time.Hour).After(time.Now()) {
			response := models.Resource[models.ImportUser]{Data: users.Users, Message: "Successfully fetched users from provider"}
			if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
				log.Error("Error writing response:" + err.Error())
				srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
				return
			}
			return
		}
	}
	externalUsers, err := service.GetUsers()
	if err != nil {
		log.Error("Error getting provider service GetUsers action:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	responseUsers := make([]models.ImportUser, 0)
	for _, user := range externalUsers {
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			continue
		}
		responseUsers = append(responseUsers, user)
	}
	cachedProviderUsers[uint(service.ProviderPlatformID)] = CachedProviderUsers{Users: responseUsers, LastUpdated: time.Now()}
	response := models.Resource[models.ImportUser]{Data: responseUsers, Message: "Successfully fetched users from provider"}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Error("Error writing response:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) HandleImportPrograms(w http.ResponseWriter, r *http.Request) {
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	err = service.GetPrograms()
	if err != nil {
		log.Error("Error getting provider service GetPrograms:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
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
			err := service.GetMilestonesForProgramUser(program.ExternalID, userMapping.ExternalUserID)
			if err != nil {
				log.Errorf("Error getting provider service milestones: %v", err)
				continue
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
	programs, err := srv.Db.GetProgramByProviderPlatformID(int(service.ProviderPlatformID))
	if err != nil {
		log.Errorf("Error getting programs and user mappings for provider: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, program := range programs {
		log.Printf("Program ID: %d", program.ID)
		err := service.GetActivityForProgram(program.ExternalID)
		if err != nil {
			log.Errorf("Error getting provider service activity: %v", err)
			continue
		}
	}
}
