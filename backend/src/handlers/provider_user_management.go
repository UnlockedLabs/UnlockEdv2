package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"unicode"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderUserRoutes() []routeDef {
	// these are not 'actions' routes because they do not directly interact with the middleware
	axx := models.ProviderAccess
	return []routeDef{
		adminValidatedFeatureRoute("POST /api/provider-platforms/{id}/map-user/{user_id}", srv.handleMapProviderUser, axx, FacilityAdminResolver("users", "user_id")),
		adminFeatureRoute("POST /api/provider-platforms/{id}/users/import", srv.handleImportProviderUsers, axx),
		adminFeatureRoute("POST /api/provider-platforms/{id}/create-user/{user_id}", srv.handleCreateProviderUserAccount, axx),
	}
}

// This function is used to take an existing canvas user that we receive from the middleware,
// in the request body, and a currently existing user's ID in the path, and create a mapping
// for that user, as well as create a login for that user in the provider
func (srv *Server) handleMapProviderUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("provider_platform_id", providerId)
	var userBody models.ImportUser
	err = json.NewDecoder(r.Body).Decode(&userBody)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	userId, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userId)
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	user, err := srv.Db.GetUserByID(uint(userId))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	mapping := models.ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: provider.ID,
		ExternalUsername:   userBody.ExternalUsername,
		ExternalUserID:     userBody.ExternalUserID,
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	// create login for user
	if provider.OidcID != 0 {
		if err := srv.registerProviderLogin(provider, user); err != nil {
			return newInternalServerServiceError(err, "Error creating provider login")
		}
	}
	return writeJsonResponse(w, http.StatusCreated, mapping)
}

type ImportUserResponse struct {
	Username     string `json:"username"`
	TempPassword string `json:"temp_password"`
	Error        string `json:"error"`
}

func stripNonAlphaChars(str string, keepCharacter func(char rune) bool) string {
	return strings.Map(func(r rune) rune {
		if keepCharacter(r) {
			return r
		}
		return -1
	}, str)
}

// This function takes an array of 1 or more Provider users (that come from the middleware, so they are
// already in the correct format) and creates a new user in the database for each of them, as well as
// creating a mapping for each user, and creating a login for each user in the provider
func (srv *Server) handleImportProviderUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityId := srv.getFacilityID(r)
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("facilityId", facilityId)
	log.add("providerId", providerId)
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	type ImportUserBody struct {
		Users []models.ImportUser `json:"users"`
	}
	var users ImportUserBody
	err = json.NewDecoder(r.Body).Decode(&users)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	toReturn := make([]ImportUserResponse, 0)
	var (
		isLetterOrNumber = func(char rune) bool {
			return unicode.IsLetter(char) || unicode.IsDigit(char)
		}
		isLetterOrSpace = func(char rune) bool {
			return unicode.IsLetter(char) || unicode.IsSpace(char)
		}
	)
	for _, user := range users.Users {
		newUser := models.User{
			Username:   stripNonAlphaChars(user.Username, isLetterOrNumber),
			Email:      user.Email,
			NameFirst:  stripNonAlphaChars(user.NameFirst, isLetterOrSpace),
			NameLast:   stripNonAlphaChars(user.NameLast, isLetterOrSpace),
			FacilityID: facilityId,
			Role:       models.Student,
		}
		if claims := r.Context().Value(ClaimsKey).(*Claims); claims != nil {
			newUser.CreateUserID = &claims.UserID
		}
		userResponse := ImportUserResponse{
			Username: newUser.Username,
		}
		err := srv.WithUserContext(r).CreateUser(&newUser)
		if err != nil {
			log.error("Error creating user in import-provider-users", err)
			userResponse.Error = "error creating user, likely a duplicate username"
			toReturn = append(toReturn, userResponse)
			continue
		}
		tempPw, err := newUser.CreateTempPassword()
		if err != nil {
			log.error("Error creating temp password for user in import-provider-users", err)
			userResponse.Error = "error creating temp password for user"
			toReturn = append(toReturn, userResponse)
			continue
		}
		userResponse.TempPassword = tempPw
		if err := srv.HandleCreateUserKratos(newUser.Username, tempPw); err != nil {
			if err = srv.Db.DeleteUser(int(newUser.ID)); err != nil {
				log.error("Error deleting user after failed provider user mapping import-provider-users")
			}
			log.warnf("Error creating user in kratos: %v, deleting the user for atomicity", err)
			userResponse.Error = "error creating authentication for user in kratos, please try again"
			toReturn = append(toReturn, userResponse)
			continue
		}
		if kolibri, err := srv.Db.FindKolibriInstance(); err == nil {
			if err = srv.CreateUserInKolibri(&newUser, kolibri); err != nil {
				log.error("Error creating kolibri user")
			}
		}
		mapping := models.ProviderUserMapping{
			UserID:             newUser.ID,
			ProviderPlatformID: provider.ID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			if err = srv.Db.DeleteUser(int(newUser.ID)); err != nil {
				log.error("Error deleting user after failed provider user mapping import-provider-users")
			}
			userResponse.Error = "user was created in database, but there was an error creating provider user mapping, please try again"
			toReturn = append(toReturn, userResponse)
			continue
		}
		if provider.OidcID != 0 {
			if err = srv.registerProviderLogin(provider, &newUser); err != nil {
				log.error("error creating provider login, user has been deleted")
				userResponse.Error = "user was created in database, but there was an error creating provider login, please try again"
				toReturn = append(toReturn, userResponse)
				continue
			}
		}
		toReturn = append(toReturn, userResponse)
	}
	return writeJsonResponse(w, http.StatusOK, toReturn)
}

func (srv *Server) registerProviderLogin(provider *models.ProviderPlatform, user *models.User) error {
	if provider.Type == models.CanvasCloud || provider.Type == models.CanvasOSS {
		err := srv.registerCanvasUserLogin(provider, user)
		if err != nil {
			log.Errorf("Error registering canvas user login createProviderLogin")
			return err
		}
	}
	// TODO: implement login creation for kolibri
	return nil
}

func (srv *Server) handleCreateProviderUserAccount(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("provider_platform_id", id)
	user_id_int, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", user_id_int)
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	user, err := srv.Db.GetUserByID(uint(user_id_int))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	// if we aren't in a testing environment, register the user with Canvas or Kolibri
	if err = srv.createAndRegisterProviderUserAccount(provider, user); err != nil {
		return newInternalServerServiceError(err, err.Error())
	}
	return writeJsonResponse(w, http.StatusCreated, "User created successfully")
}

func (srv *Server) createAndRegisterProviderUserAccount(provider *models.ProviderPlatform, user *models.User) error {
	fields := log.Fields{"func": "createAndRegisterCanvasUserAccount"}
	if provider.Type == models.CanvasCloud || provider.Type == models.CanvasOSS {
		return srv.createAndRegisterCanvasUserAccount(provider, user)
	} else {
		log.WithFields(fields).Println("creating kolibri user")
		return srv.CreateUserInKolibri(user, provider)
	}
}
