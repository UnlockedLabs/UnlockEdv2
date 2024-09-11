package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActionsRoutes() {
	// returns the users for mapping on the client
	srv.Mux.Handle("GET /api/actions/provider-platforms/{id}/get-users", srv.applyMiddleware(srv.HandleError(srv.HandleGetUsers)))
	srv.Mux.Handle("POST /api/actions/provider-platforms/{id}/import-users", srv.applyMiddleware(srv.HandleError(srv.HandleImportUsers)))
}

type CachedProviderUsers struct {
	Users       []models.ImportUser
	LastUpdated time.Time
}

func (srv *Server) HandleImportUsers(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleImportUsers", "file": "actions"}
	service, err := srv.getService(r)
	if err != nil {
		fields["error"] = err.Error()
		return newBadRequestServiceError(err, err.Error(), fields)
	}
	users, err := service.GetUsers()
	if err != nil {
		fields["error"] = err.Error()
		return newInternalServerServiceError(err, err.Error(), fields)
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	if err != nil {
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
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
		tempPw := created.CreateTempPassword()
		if !srv.isTesting(r) {
			if err := srv.HandleCreateUserKratos(created.Username, tempPw); err != nil {
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
			return newDatabaseServiceError(err, fields)
		}
		if provider.OidcID != 0 {
			// this should never be any other case, as it's triggered by the UI only (if oidc_id != 0). but we still check
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.Errorln("Error registering provider login", err)
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

func (srv *Server) HandleGetUsers(w http.ResponseWriter, r *http.Request) error {
	kv := srv.buckets[CachedUsers]
	page, perPage := srv.GetPaginationInfo(r)
	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error(), nil)
	}

	cacheKey := fmt.Sprintf("provider_%d_users", service.ProviderPlatformID)
	fresh := r.URL.Query().Get("clear_cache")
	if strings.Compare(fresh, "true") == 0 {
		log.Debug("clearing cached provider users in JetStream, re-fetching from provider")
		if err := kv.Delete(cacheKey); err != nil {
			log.Errorf("Error clearing cache: %v", err)
		}
	}
	search := r.URL.Query().Get("search")
	entry, err := kv.Get(cacheKey)
	if err == nil {
		var cachedUsers CachedProviderUsers
		if err := json.Unmarshal(entry.Value(), &cachedUsers); err == nil {
			if cachedUsers.LastUpdated.Add(1 * time.Hour).After(time.Now()) {
				foundUsers := cachedUsers.Users
				if search != "" {
					foundUsers = srv.searchForUser(search, foundUsers)
				}
				total, toReturn := paginateUsers(foundUsers, page, perPage)
				meta := models.NewPaginationInfo(page, perPage, int64(total))
				return writePaginatedResponse(w, http.StatusOK, toReturn, meta)
			}
		}
		if kv.Delete(cacheKey) != nil {
			log.Error("Error deleting cache key")
		}
	}

	externalUsers, err := service.GetUsers()
	if err != nil {
		if kv.Delete(cacheKey) != nil {
			log.Error("Error deleting cache")
		}
		return newInternalServerServiceError(err, err.Error(), nil)
	}
	cachedUsers := CachedProviderUsers{
		Users:       externalUsers,
		LastUpdated: time.Now(),
	}
	cacheData, err := json.Marshal(&cachedUsers)
	if err == nil {
		_, err := kv.Put(cacheKey, cacheData)
		if err != nil {
			log.Error("Error caching users")
		}
	}
	log.Printf("Received import users: %v", externalUsers)
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
