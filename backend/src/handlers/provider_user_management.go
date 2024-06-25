package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderUserRoutes() {
	// these are not 'actions' routes because they do not directly interact with the middleware
	srv.Mux.Handle("POST /api/provider-platforms/{id}/map-user/{user_id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleMapProviderUser)))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/users/import", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleImportProviderUsers)))
	srv.Mux.Handle("POST /api/provider-platforms/{id}/create-user", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleCreateProviderUserAccount)))
}

// This function is used to take an existing canvas user that we receive from the middleware,
// in the request body, and a currently existing user's ID in the path, and create a mapping
// for that user, as well as create a login for that user in the provider
func (srv *Server) HandleMapProviderUser(w http.ResponseWriter, r *http.Request) {
	providerId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid provider platform ID")
		return
	}
	defer r.Body.Close()
	var userBody models.ImportUser
	err = json.NewDecoder(r.Body).Decode(&userBody)
	if err != nil {
		log.Errorln("Error decoding exernal user body from request in map-provider-user")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user body")
		return
	}
	userId, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(providerId)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error getting provider platform")
		return
	}
	user, err := srv.Db.GetUserByID(uint(userId))
	if err != nil {
		log.Errorln("Error getting user by ID to map to provider-user")
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
	if err = srv.WriteResponse(w, http.StatusCreated, mapping); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Errorln("Error writing response for map-provider-user")
		return
	}
}

type ImportUserResponse struct {
	Username     string `json:"username"`
	TempPassword string `json:"temp_password"`
	Error        string `json:"error"`
}

// This function takes an array of 1 or more Provider users (that come from the middleware, so they are
// already in the correct format) and creates a new user in the database for each of them, as well as
// creating a mapping for each user, and creating a login for each user in the provider
func (srv *Server) HandleImportProviderUsers(w http.ResponseWriter, r *http.Request) {
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
		newUser := models.User{
			Username:  user.Username,
			Email:     user.Email,
			NameFirst: user.NameFirst,
			NameLast:  user.NameLast,
		}
		userResponse := ImportUserResponse{
			Username: newUser.Username,
		}
		created, err := srv.Db.CreateUser(&newUser)
		if err != nil {
			log.Errorln("Error creating user in import-provider-users")
			userResponse.Error = "error creating user in database, please try again"
			response.Data = append(response.Data, userResponse)
			continue
		}
		userResponse.TempPassword = created.Password
		// if we aren't in a testing environment, register the user as an Identity with Kratos
		if !srv.isTesting(r) {
			if err := srv.handleCreateUserKratos(created.Username, created.Password); err != nil {
				if err = srv.Db.DeleteUser(int(created.ID)); err != nil {
					log.Errorf("Error deleting user after failed provider user mapping import-provider-users")
					log.Printf("Error creating user in kratos: %v", err)
					userResponse.Error = "error creating authentication for user in kratos, please try again"
					response.Data = append(response.Data, userResponse)
					continue
				}
			}
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
				// for atomicity, we should delete the user if the mapping fails
				userResponse.Error = "user was created in database, but there was an error creating provider user mapping, please try again"
				response.Data = append(response.Data, userResponse)
				continue
			}
		}
		if provider.OidcID != 0 {
			if err = srv.registerProviderLogin(provider, &newUser); err != nil {
				if err = srv.Db.DeleteUser(int(created.ID)); err != nil {
					log.Errorf("Error deleting user after failed provider login creation import-provider-users")
					userResponse.Error = "user was created in database, but there was an error creating provider login, please try again"
					response.Data = append(response.Data, userResponse)
					continue
				}
			}
		}
		response.Data = append(response.Data, userResponse)
	}
	response.Message = "Provider users imported, please check for any accounts that couldn't be created"
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Errorln("Error writing response for import-provider-users")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
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

func (srv *Server) registerCanvasUserLogin(provider *models.ProviderPlatform, user *models.User) error {
	providerMapping, err := srv.Db.GetProviderUserMapping(int(user.ID), int(provider.ID))
	if err != nil {
		log.Error("Error getting provider user mapping registerCanvasUserLogin")
		return err
	}
	if providerMapping.ExternalLoginID != "" {
		return errors.New("user already has login in canvas")
	}
	body := url.Values{}
	body.Add("user[id]", providerMapping.ExternalUserID)
	body.Add("login[unique_id]", user.Username)
	body.Add("login[authentication_provider_id]", "openid_connect")
	url := body.Encode()
	request, err := http.NewRequest("POST", provider.BaseUrl+"/api/v1/accounts/"+provider.AccountID+"/logins?"+url, nil)
	if err != nil {
		log.Errorf("Error creating request object registerCanvasUserLogin")
		return err
	}
	request.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	resp, err := srv.Client.Do(request)
	if err != nil {
		log.Errorf("Error sending request to canvas registerCanvasUserLogin")
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error creating login in canvas registerCanvasUserLogin")
		return errors.New("error creating login in canvas")
	}
	var loginResponse map[string]interface{}
	if err = json.NewDecoder(resp.Body).Decode(&loginResponse); err != nil {
		log.Errorf("Error decoding response registerCanvasUserLogin")
		return err
	}
	if loginResponse["id"] == nil {
		log.Errorf("Error creating login in canvas registerCanvasUserLogin")
		return errors.New("error creating login in canvas")
	}
	newId, ok := loginResponse["id"].(float64)
	if !ok {
		log.Errorf("Error parsing id from response registerCanvasUserLogin")
		return errors.New("error creating login in canvas")
	}
	providerMapping.ExternalLoginID = strconv.Itoa(int(newId))
	providerMapping.AuthenticationProviderStatus = models.OpenIDConnect
	if err = srv.Db.UpdateProviderUserMapping(providerMapping); err != nil {
		log.Errorf("Error updating provider user mapping registerCanvasUserLogin")
		return err
	}
	return nil
}

// create new user in canvas, return new user id
func (srv *Server) createUserInCanvas(user *models.User, providerId uint) (int, error) {
	provider, err := srv.Db.GetProviderPlatformByID(int(providerId))
	if err != nil {
		log.Errorf("Error getting provider platform by id createUserInCanvas")
		return 0, err
	}
	body := url.Values{}
	body.Add("user[sortable_name]", user.Username)
	body.Add("user[name]", user.NameLast+", "+user.NameFirst)
	body.Add("user[locale]", "en")
	body.Add("user[terms_of_use]", "true")
	body.Add("user[skip_registration]", "true")
	body.Add("pseudonym[unique_id]", user.Username)
	body.Add("pseudonym[sis_user_id]", strconv.Itoa(int(user.ID)))
	body.Add("pseudonym[send_confirmation]", "false")
	body.Add("communication_channel[skip_confirmation]", "true")
	url := body.Encode()
	request, err := http.NewRequest("POST", provider.BaseUrl+"/api/v1/accounts/"+provider.AccountID+"/users?"+url, nil)
	if err != nil {
		log.Errorf("Error creating request object createUserInCanvas")
		return 0, err
	}
	log.Println("Access Key: ", provider.AccessKey)
	request.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	log.Debug("Request: ", request.URL)
	resp, err := srv.Client.Do(request)
	if err != nil {
		log.Errorf("Error sending request to canvas createUserInCanvas")
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error creating user in canvas createUserInCanvas")
		return 0, errors.New("error creating user in canvas")
	}
	var userResponse map[string]interface{}
	if err = json.NewDecoder(resp.Body).Decode(&userResponse); err != nil {
		log.Errorf("Error decoding response createUserInCanvas")
		return 0, err
	}
	if userResponse["id"] == nil {
		log.Errorf("Error creating user in canvas createUserInCanvas")
		return 0, err
	}
	newId, ok := userResponse["id"].(float64)
	if !ok {
		log.Errorf("Error parsing id from response createUserInCanvas")
		return 0, err
	}
	return int(newId), nil
}

func (srv *Server) handleCreateProviderUserAccount(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing provider id from path createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid provider platform id")
		return
	}
	user_id_int, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		log.Errorf("Error parsing user id from path createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		log.Errorf("Error getting provider platform by id createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	user, err := srv.Db.GetUserByID(uint(user_id_int))
	if err != nil {
		log.Error("Error getting user by id createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusNotFound, "User not found")
		return
	}
	if err = srv.createAndRegisterProviderUserAccount(provider, user); err != nil {
		log.Errorf("Error creating provider user account createProviderUserAccount")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusCreated, nil); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) createAndRegisterProviderUserAccount(provider *models.ProviderPlatform, user *models.User) error {
	if provider.Type == models.CanvasCloud || provider.Type == models.CanvasOSS {
		newId, err := srv.createUserInCanvas(user, uint(provider.ID))
		if err != nil {
			log.Errorf("Error creating user in canvas createProviderUserAccount")
			return err
		}
		providerMapping := models.ProviderUserMapping{
			UserID:           user.ID,
			ProviderPlatform: provider,
			ExternalUserID:   strconv.Itoa(newId),
			ExternalUsername: user.Username,
		}
		if err = srv.Db.CreateProviderUserMapping(&providerMapping); err != nil {
			log.Errorf("Error creating provider user mapping createProviderUserAccount")
			return err
		}
		err = srv.registerCanvasUserLogin(provider, user)
		if err != nil {
			log.Errorf("Error registering canvas user login createProviderUserAccount")
			return err
		}

	} else {
		// TODO: Kolibri account creation
		return nil
	}
	return nil
}
