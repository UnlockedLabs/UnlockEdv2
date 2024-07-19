package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() {
	// returns the users for mapping on the client
	srv.Mux.Handle("GET /api/actions/provider-platforms/{id}/get-users", srv.applyMiddleware(srv.HandleGetUsers))

	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-users", srv.applyMiddleware(srv.HandleImportUsers))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-programs", srv.applyMiddleware(srv.HandleImportPrograms))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-milestones", srv.applyMiddleware(srv.HandleImportMilestones))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-activity", srv.applyMiddleware(srv.HandleImportActivity))
}

/****************************************************************************************************
* Due to how the middleware now works, ALL ID's used to communicate between backend <-> middleware
* will be OUR local ID's. This means the middleware must handle doing lookups to get the appropriate
* foreign/externalID's in order to make the relevant calls to the provider.
*****************************************************************************************************/

type CachedProviderUsers struct {
	Users       []models.ImportUser
	LastUpdated time.Time
}

var cachedProviderUsers = make(map[uint]CachedProviderUsers)

func (srv *Server) HandleImportUsers(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleImportUsers", "file": "actions"}
	service, err := srv.getService(r)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	users, err := service.GetUsers()
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error getting provider service GetUsers action:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorf("Error getting provider platform by id: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, user := range users {
		// if this user was parsed improperly (happens randomly, unknown as to why), skip
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			fields["error"] = err.Error()
			log.WithFields(fields).Debug("received user with null values from provider, skipping")
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
			if err := srv.HandleCreateUserKratos(created.Username, created.Password); err != nil {
				fields["error"] = err.Error()
				log.WithFields(fields).Errorf("Error creating user in kratos: %v", err)
				// FIXME: Error handling if we fail/handle atomicity
			}
		}
		mapping := models.ProviderUserMapping{
			UserID:             created.ID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Errorf("error creating a mapping between user %v and provider %d", user, provider.ID)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		if provider.OidcID != 0 {
			// this should never be any other case, as it's triggered by the UI only (if oidc_id != 0). but we still check
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.Errorln("Error registering provider login", err)
			}
		}
	}
	w.WriteHeader(http.StatusOK)
}

func paginateUsers(users []models.ImportUser, page, perPage int) (int, []models.ImportUser) {
	totalUsers := len(users)
	log.Debugf("total of %d uses found to import, returning %d", totalUsers, perPage)
	offset := (page - 1) * perPage
	if offset > totalUsers {
		return totalUsers, []models.ImportUser{}
	}
	end := offset + perPage
	if end > totalUsers {
		end = totalUsers
	}
	return totalUsers, users[offset:end]
}

// Here we get all the users from a Provider and send them to the client to be
// mapped by hand or imported into our system
func (srv *Server) HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	service, err := srv.getService(r)
	if err != nil {
		log.Errorf("Error getting provider service: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	fresh := r.URL.Query().Get("clear_cache")
	if strings.Compare(fresh, "true") == 0 {
		log.Debug("clearing cached provider users, re-fetching from provider")
		delete(cachedProviderUsers, uint(service.ProviderPlatformID))
	}
	if users, ok := cachedProviderUsers[uint(service.ProviderPlatformID)]; ok {
		if users.LastUpdated.Add(12 * time.Hour).After(time.Now()) {
			total, toReturn := paginateUsers(users.Users, page, perPage)
			response := models.PaginatedResource[models.ImportUser]{
				Data:    toReturn,
				Message: "Successfully fetched users from provider",
				Meta:    models.NewPaginationInfo(page, perPage, int64(total)),
			}
			srv.WriteResponse(w, http.StatusOK, response)
			return
		} else {
			delete(cachedProviderUsers, uint(service.ProviderPlatformID))
		}
	}
	externalUsers, err := service.GetUsers()
	if err != nil {
		log.Error("Error getting provider service GetUsers action:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		delete(cachedProviderUsers, uint(service.ProviderPlatformID))
		return
	}
	log.Printf("Received import users: %v", externalUsers)
	total, responseUsers := paginateUsers(externalUsers, page, perPage)
	cachedProviderUsers[uint(service.ProviderPlatformID)] = CachedProviderUsers{Users: externalUsers, LastUpdated: time.Now()}
	response := models.PaginatedResource[models.ImportUser]{Data: responseUsers, Message: "Successfully fetched users from provider", Meta: models.NewPaginationInfo(page, perPage, int64(total))}
	srv.WriteResponse(w, http.StatusOK, response)
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
	srv.WriteResponse(w, http.StatusOK, models.Resource[interface{}]{Message: "Successfully imported courses"})
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
		for _, userMapping := range userMappings {
			err := service.GetMilestonesForProgramUser(program.ID, userMapping.UserID)
			if err != nil {
				log.Errorf("Error getting provider service milestones: %v", err)
				continue
			}
		}
	}
	srv.WriteResponse(w, http.StatusOK, models.Resource[interface{}]{Message: "Successfully imported Milestones"})
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
		return
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
	w.WriteHeader(http.StatusOK)
}
