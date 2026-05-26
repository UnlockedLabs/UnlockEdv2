package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() []routeDef {
	// returns the users for mapping on the client
	axx := models.ProviderAccess
	return []routeDef{
		adminFeatureRoute("GET /api/actions/provider-platforms/{id}/get-users", srv.handleGetUsers, axx),
		adminFeatureRoute("POST /api/actions/provider-platforms/{id}/import-users", srv.handleImportUsers, axx),
		adminFeatureRoute("GET /api/actions/provider-platforms/{id}/match-users", srv.handleMatchUsers, axx),
		adminFeatureRoute("POST /api/actions/provider-platforms/{id}/apply-matches", srv.handleApplyMatches, axx),
	}
}

func (srv *Server) handleImportUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.add("file", "actions")
	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}
	users, err := service.GetUsers()
	if err != nil {
		return newInternalServerServiceError(err, err.Error())
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	log.add("ProviderPlatformID", service.ProviderPlatformID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	for _, user := range users {
		// if this user was parsed improperly (happens randomly, unknown as to why), skip
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			log.add("error", err)
			log.debugf("received user with null values from provider: %d, skipping", provider.ID)
			continue
		}
		newUser := models.User{
			Username:  user.Username,
			Email:     user.Email,
			NameFirst: user.NameFirst,
			NameLast:  user.NameLast,
		}
		err := srv.WithUserContext(r).CreateUser(&newUser)
		if err != nil {
			log.error("Error creating user:" + err.Error())
			continue
		}
		tempPw, err := newUser.CreateTempPassword()
		if err != nil {
			log.add("error", err.Error())
			log.errorf("Error creating temp password: %v", err)
		}
		if err := srv.HandleCreateUserKratos(newUser.Username, tempPw); err != nil {
			log.add("error", err.Error())
			log.errorf("Error creating user in kratos: %v", err)
			// FIXME: Error handling if we fail/handle atomicity
		}
		mapping := models.ProviderUserMapping{
			UserID:             newUser.ID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			log.add("created.ID", newUser.ID)
			log.add("ExternalUserID", user.ExternalUserID)
			log.errorf("error creating a mapping between user %v and provider %d", user, provider.ID)
			return newDatabaseServiceError(err)
		}
		if provider.OidcID != 0 {
			// this should never be any other case, as it's triggered by the UI only (if oidc_id != 0). but we still check
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.error("Error registering provider login", err)
			}
		}
	}
	return writeJsonResponse(w, http.StatusOK, "Users imported successfully")
}

func paginateUsers(users []models.ImportUser, page, perPage int) (int, []models.ImportUser) {
	totalUsers := len(users)
	if totalUsers == 0 {
		return 0, []models.ImportUser{}
	}
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

func (srv *Server) searchForUser(search string, users []models.ImportUser) []models.ImportUser {
	foundUsers := []models.ImportUser{}
	for _, user := range users {
		if strings.Contains(user.Username, search) || strings.Contains(user.NameFirst, search) || strings.Contains(user.NameLast, search) {
			foundUsers = append(foundUsers, user)
		}
	}
	return foundUsers
}

func (srv *Server) handleGetUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}

	search := r.URL.Query().Get("search")
	externalUsers, err := service.GetUsers()
	if err != nil {
		return newInternalServerServiceError(err, err.Error())
	}
	log.infof("Received import users: %v", externalUsers)
	if search != "" {
		externalUsers = srv.searchForUser(search, externalUsers)
	}
	total, responseUsers := paginateUsers(externalUsers, page, perPage)

	meta := models.NewPaginationInfo(page, perPage, int64(total))
	return writePaginatedResponse(w, http.StatusOK, responseUsers, meta)
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
	return src.GetProviderService(provider, srv.Client)
}
