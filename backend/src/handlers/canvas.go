package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

// creates a new account in canvas,
func (srv *Server) createAndRegisterCanvasUserAccount(provider *models.ProviderPlatform, user *models.User) error {
	fields := log.Fields{"user_id": user.ID, "provider_platform_id": provider.ID}
	newId, err := srv.createUserInCanvas(user, uint(provider.ID))
	if err != nil {
		log.WithFields(fields).Errorf("Error creating user in canvas createProviderUserAccount")
		return err
	}
	providerMapping := models.ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     strconv.Itoa(newId),
		ExternalUsername:   user.Username,
	}
	if err = srv.Db.CreateProviderUserMapping(&providerMapping); err != nil {
		log.WithFields(fields).Errorf("Error creating provider user mapping createProviderUserAccount")
		return err
	}
	req, err := http.NewRequest("GET", provider.BaseUrl+"/api/v1/users/"+fmt.Sprintf("%d", newId)+"/logins", nil)
	if err != nil {
		log.WithFields(fields).Error("error fetching logins for newly created user in canvas")
		return err
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.WithFields(fields).Error("error sending request to canvas getting user logins")
		return err
	}
	var body []map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&body)
	if err != nil {
		log.WithFields(fields).Error("error unmarshaling json from canvas getting user logins")
		return err
	}
	if resp.StatusCode != 200 {
		log.WithFields(fields).Error("error getting from canvas getting user logins with error: ", resp.Status)
		return errors.New("unable to fetch user logins from canvas")
	}
	for _, login := range body {
		if authType, ok := login["authentication_provider_type"].(string); ok {
			if strings.Compare(authType, "openid_connect") != 0 {
				continue
			}
		}
		id, ok := login["id"].(float64)
		if !ok {
			log.WithFields(fields).Error("error unmarshaling json from canvas getting user logins")
			return errors.New("unable to decode ID of login from canvas")
		}
		providerMapping.ExternalLoginID = fmt.Sprintf("%d", int(id))
		return srv.Db.UpdateProviderUserMapping(&providerMapping)
	}
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
	if provider.ExternalAuthProviderId == "" {
		log.Error("this shouldn't happen, when provider oidc client is enabled we should have the foreign auth key")
		return errors.New("provider is not registered as an auth client, please register first")
	}
	body := url.Values{}
	body.Add("user[id]", providerMapping.ExternalUserID)
	body.Add("login[unique_id]", user.Username)
	body.Add("login[authentication_provider_id]", provider.ExternalAuthProviderId)
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
		log.Errorf("Error creating login in canvas registerCanvasUserLogin with code: %s", resp.Status)
		return errors.New("error creating login in canvas")
	}
	var loginResponse map[string]interface{}
	if err = json.NewDecoder(resp.Body).Decode(&loginResponse); err != nil {
		log.Errorf("Error decoding response registerCanvasUserLogin")
		return err
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
	body.Add("pseudonym[authentication_provider_id]", "openid_connect")
	// body.Add("pseudonym[sis_user_id]", strconv.Itoa(int(user.ID)))
	body.Add("pseudonym[send_confirmation]", "false")
	body.Add("communication_channel[skip_confirmation]", "true")
	url := body.Encode()
	request, err := http.NewRequest("POST", provider.BaseUrl+"/api/v1/accounts/"+provider.AccountID+"/users?"+url, nil)
	if err != nil {
		log.Errorf("Error creating request object createUserInCanvas")
		return 0, err
	}
	log.Debug("registration string for creating provider user in canvas: ", request.URL.String())
	request.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	resp, err := srv.Client.Do(request)
	if err != nil {
		log.Errorf("Error sending request to canvas createUserInCanvas")
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Error("Error creating user in canvas createUserInCanvas: ", resp.Body, resp.Status)
		return 0, errors.New("error creating user in canvas")
	}
	var userResponse map[string]interface{}
	if err = json.NewDecoder(resp.Body).Decode(&userResponse); err != nil {
		log.Errorf("Error decoding response createUserInCanvas")
		return 0, err
	}
	newId, ok := userResponse["id"].(float64)
	if !ok {
		log.Errorf("Error parsing id from response createUserInCanvas")
		return 0, err
	}
	return int(newId), nil
}

// This requires that the password is set to an UNHASHED plaintext temporary password
// don't call this method on a normal user queried from the database
func (srv *Server) CreateUserInKolibri(user *models.User, prov *models.ProviderPlatform) error {
	fields := log.Fields{"user_id": user.ID, "provider_platform_id": prov.ID}
	log.WithFields(fields).Info("creating user in kolibri")
	kUser := make(map[string]interface{}, 0)
	kUser["facility"] = prov.AccountID
	kUser["full_name"] = user.NameFirst + user.NameLast
	kUser["password"] = user.Password
	kUser["username"] = user.Username
	kUser["id_number"] = user.ID
	kUser["gender"] = "NOT_SPECIFIED"
	kUser["birth_year"] = "NOT_SPECIFIED"
	kUser["extra_demographics"] = make(map[string]interface{})
	body, err := json.Marshal(kUser)
	if err != nil {
		log.Error("error marshaling user for kolibri")
		return err
	}
	request, err := http.NewRequest(http.MethodPost, prov.BaseUrl+"/api/public/signup/", bytes.NewReader(body))
	if err != nil {
		log.Error("error creating request for kolibri user creation")
		return err
	}
	request.Header.Add("Content-Type", "application/json")
	resp, err := srv.Client.Do(request)
	if err != nil {
		log.Error("error sending request to kolibri for user creation")
		return err
	}
	defer resp.Body.Close()
	var data map[string]interface{}
	log.Printf("response from kolibri user creation: %s", resp.Status)
	if err = json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Error("error decoding response from kolibri for user creation")
		return err
	}
	log.Printf("response from kolibri user creation: %s", data)
	id, ok := data["id"].(string)
	if !ok {
		log.Error("error parsing id from response from kolibri for user creation")
		return errors.New("error creating user in kolibri")
	}
	providerMapping := models.ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: prov.ID,
		ExternalUserID:     id,
		ExternalUsername:   user.Username,
	}
	if err := srv.Db.CreateProviderUserMapping(&providerMapping); err != nil {
		log.Error("error creating provider user mapping for kolibri user creation")
		return err
	}
	return nil
}
