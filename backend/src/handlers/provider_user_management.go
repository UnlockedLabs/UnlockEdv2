package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderUserRoutes() {
	// these are not 'actions' routes because they do not directly interact with the middleware
	srv.Mux.Handle("POST /api/provider-platforms/{id}/map-user/{user_id}", srv.ApplyAdminMiddleware(srv.HandleMapProviderUser))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/users/import", srv.ApplyAdminMiddleware(srv.HandleImportProviderUsers))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/create-user", srv.ApplyAdminMiddleware(srv.handleCreateProviderUserAccount))
}

// This function is used to take an existing canvas user that we receive from the middleware,
// in the request body, and a currently existing user's ID in the path, and create a mapping
// for that user, as well as create a login for that user in the provider
func (srv *Server) HandleMapProviderUser(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleMapProviderUser"}
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid provider platform ID")
		return
	}
	fields["provider_platform_id"] = providerId
	defer r.Body.Close()
	var userBody models.ImportUser
	err = json.NewDecoder(r.Body).Decode(&userBody)
	if err != nil {
		log.WithFields(fields).Errorln("Error decoding exernal user body from request in map-provider-user")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user body")
		return
	}
	userId, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		log.WithFields(fields).Errorln("error decoding user id into integer")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	fields["user_id"] = userId
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		log.WithFields(fields).Errorln("Error getting provider platform by ID")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error getting provider platform")
		return
	}
	user, err := srv.Db.GetUserByID(uint(userId))
	if err != nil {
		log.WithFields(fields).Errorln("Error getting user by ID to map to provider-user")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error getting user to map to provider user")
		return
	}
	mapping := models.ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: provider.ID,
		ExternalUsername:   userBody.ExternalUsername,
		ExternalUserID:     userBody.ExternalUserID,
	}
	err = srv.Db.CreateProviderUserMapping(&mapping)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error creating provider user mapping")
		return
	}
	// create login for user
	if provider.OidcID != 0 {
		if err := srv.registerProviderLogin(provider, user); err != nil {
			srv.ErrorResponse(w, http.StatusInternalServerError, "Error creating provider login")
			return
		}
	}
	srv.WriteResponse(w, http.StatusCreated, mapping)
}

type ImportUserResponse struct {
	Username     string `json:"username"`
	TempPassword string `json:"temp_password"`
	Error        string `json:"error"`
}

func removeChars(str string, toStrip string) string {
	removeMap := make(map[rune]bool)
	for _, char := range toStrip {
		removeMap[char] = true
	}
	return strings.Map(func(r rune) rune {
		if removeMap[r] {
			return -1
		}
		return r
	}, str)
}

const disallowedChars string = "`; )(|\\\"'"

// This function takes an array of 1 or more Provider users (that come from the middleware, so they are
// already in the correct format) and creates a new user in the database for each of them, as well as
// creating a mapping for each user, and creating a login for each user in the provider
func (srv *Server) HandleImportProviderUsers(w http.ResponseWriter, r *http.Request) {
	facilityId := srv.getFacilityID(r)
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid provider platform ID")
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error getting provider platform")
		return
	}
	type ImportUserBody struct {
		Users []models.ImportUser `json:"users"`
	}
	var users ImportUserBody
	defer r.Body.Close()
	err = json.NewDecoder(r.Body).Decode(&users)
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user body")
		log.Errorln("Error decoding exernal user body from request in import-provider-users")
		return
	}
	var response models.Resource[ImportUserResponse]
	for _, user := range users.Users {
		username := removeChars(user.Username, disallowedChars)
		newUser := models.User{
			Username:   username,
			Email:      user.Email,
			NameFirst:  user.NameFirst,
			NameLast:   user.NameLast,
			FacilityID: facilityId,
		}
		userResponse := ImportUserResponse{
			Username: newUser.Username,
		}
		created, err := srv.Db.CreateUser(&newUser)
		if err != nil {
			log.Errorln("Error creating user in import-provider-users", err)
			userResponse.Error = "error creating user, likely a duplicate username"
			response.Data = append(response.Data, userResponse)
			continue
		}
		userResponse.TempPassword = created.Password
		if err := srv.HandleCreateUserKratos(created.Username, created.Password); err != nil {
			if err = srv.Db.DeleteUser(int(created.ID)); err != nil {
				log.Errorf("Error deleting user after failed provider user mapping import-provider-users")
			}
			log.Warnf("Error creating user in kratos: %v, deleting the user for atomicity", err)
			userResponse.Error = "error creating authentication for user in kratos, please try again"
			response.Data = append(response.Data, userResponse)
			continue
		}
		kolibri, err := srv.Db.FindKolibriInstance()
		if err != nil {
			log.Errorln("Error getting kolibri instance")
		}
		if err = srv.CreateUserInKolibri(created, kolibri); err != nil {
			log.Errorln("Error creating kolibri user")
		}
		mapping := models.ProviderUserMapping{
			UserID:             created.ID,
			ProviderPlatformID: provider.ID,
			ExternalUsername:   user.Username,
			ExternalUserID:     user.ExternalUserID,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			if err = srv.Db.DeleteUser(int(created.ID)); err != nil {
				log.Errorf("Error deleting user after failed provider user mapping import-provider-users")
			}
			userResponse.Error = "user was created in database, but there was an error creating provider user mapping, please try again"
			response.Data = append(response.Data, userResponse)
			continue
		}
		if provider.OidcID != 0 {
			if err = srv.registerProviderLogin(provider, &newUser); err != nil {
				log.Error("error creating provider login, user has been deleted")
				userResponse.Error = "user was created in database, but there was an error creating provider login, please try again"
				response.Data = append(response.Data, userResponse)
				continue
			}
		}
		response.Data = append(response.Data, userResponse)
	}
	response.Message = "Provider users imported, please check for any accounts that couldn't be created"
	srv.WriteResponse(w, http.StatusOK, response)
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

func (srv *Server) handleCreateProviderUserAccount(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleCreateProviderUserAccount"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing provider id from path createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid provider platform id")
		return
	}
	fields["provider_platform_id"] = id
	user_id_int, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		log.WithFields(fields).Error("Error parsing user id from path")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	fields["user_id"] = id
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		log.WithFields(fields).Error("Error getting provider platform by id createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	user, err := srv.Db.GetUserByID(uint(user_id_int))
	if err != nil {
		log.WithFields(fields).Error("Error getting user by id")
		srv.ErrorResponse(w, http.StatusNotFound, "User not found")
		return
	}
	if err = srv.createAndRegisterProviderUserAccount(provider, user); err != nil {
		log.Errorf("Error creating provider user account createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	srv.WriteResponse(w, http.StatusCreated, nil)
}

func (srv *Server) createAndRegisterProviderUserAccount(provider *models.ProviderPlatform, user *models.User) error {
	fields := log.Fields{"func": "createAndRegisterCanvasUserAccount"}
	if provider.Type == models.CanvasCloud || provider.Type == models.CanvasOSS {
		return srv.createAndRegisterCanvasUserAccount(provider, user)
	} else {
		log.WithFields(fields).Println("creating kolibri user")
		user.Password = "NOT_SPECIFIED"
		return srv.CreateUserInKolibri(user, provider)
	}
}
