package providerplatforms

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	log "github.com/sirupsen/logrus"
)

// accounts creates a user's account and login at a provider platform. The
// routes and the api both use it.
type accounts struct {
	store  *store
	client *http.Client
}

func (a accounts) registerProviderLogin(provider *ProviderPlatform, user module.User) error {
	if provider.Type == CanvasCloud || provider.Type == CanvasOSS {
		err := a.registerCanvasUserLogin(provider, user)
		if err != nil {
			log.Errorf("Error registering canvas user login createProviderLogin")
			return err
		}
	}
	// TODO: implement login creation for kolibri
	return nil
}

func (a accounts) createAndRegisterProviderUserAccount(provider *ProviderPlatform, user module.User) error {
	fields := log.Fields{"func": "createAndRegisterCanvasUserAccount"}
	if provider.Type == CanvasCloud || provider.Type == CanvasOSS {
		return a.createAndRegisterCanvasUserAccount(provider, user)
	} else {
		log.WithFields(fields).Println("creating kolibri user")
		return a.createUserInKolibri(user, provider)
	}
}

// creates a new account in canvas,
func (a accounts) createAndRegisterCanvasUserAccount(provider *ProviderPlatform, user module.User) error {
	fields := log.Fields{"user_id": user.ID, "provider_platform_id": provider.ID}
	newId, err := a.createUserInCanvas(user, uint(provider.ID))
	if err != nil {
		log.WithFields(fields).Errorf("Error creating user in canvas createProviderUserAccount")
		return err
	}
	providerMapping := ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     strconv.Itoa(newId),
		ExternalUsername:   user.Username,
	}
	if err = a.store.createProviderUserMapping(&providerMapping); err != nil {
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
	resp, err := a.client.Do(req)
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
		providerMapping.ExternalLoginID = stringPtr(fmt.Sprintf("%d", int(id)))
		return a.store.updateProviderUserMapping(&providerMapping)
	}
	return nil
}

func (a accounts) getExistingCanvasOidcLoginID(provider *ProviderPlatform, externalUserID string) string {
	req, err := http.NewRequest("GET", provider.BaseUrl+"/api/v1/users/"+externalUserID+"/logins", nil)
	if err != nil {
		return ""
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	resp, err := a.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer func() { _ = resp.Body.Close() }()
	var logins []map[string]interface{}
	if err = json.NewDecoder(resp.Body).Decode(&logins); err != nil {
		return ""
	}
	for _, login := range logins {
		if authType, ok := login["authentication_provider_type"].(string); ok && strings.Compare(authType, "openid_connect") == 0 {
			if id, ok := login["id"].(float64); ok {
				return strconv.Itoa(int(id))
			}
		}
	}
	return ""
}

func (a accounts) registerCanvasUserLogin(provider *ProviderPlatform, user module.User) error {
	providerMapping, err := a.store.getProviderUserMapping(int(user.ID), int(provider.ID))
	if err != nil {
		log.Error("Error getting provider user mapping registerCanvasUserLogin")
		return err
	}
	if providerMapping.ExternalLoginID != nil {
		return errors.New("user already has login in canvas")
	}
	if provider.ExternalAuthProviderId == "" {
		log.Error("this shouldn't happen, when provider oidc client is enabled we should have the foreign auth key")
		return errors.New("provider is not registered as an auth client, please register first")
	}
	// user may already have an OIDC login in Canvas (e.g. when mapping an existing Canvas user)
	if existingID := a.getExistingCanvasOidcLoginID(provider, providerMapping.ExternalUserID); existingID != "" {
		providerMapping.ExternalLoginID = stringPtr(existingID)
		providerMapping.AuthenticationProviderStatus = OpenIDConnect
		return a.store.updateProviderUserMapping(providerMapping)
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
	resp, err := a.client.Do(request)
	if err != nil {
		log.Errorf("Error sending request to canvas registerCanvasUserLogin")
		return err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Errorf("Error closing response body registerCanvasUserLogin")
		}
	}()
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
	providerMapping.ExternalLoginID = stringPtr(strconv.Itoa(int(newId)))
	providerMapping.AuthenticationProviderStatus = OpenIDConnect
	if err = a.store.updateProviderUserMapping(providerMapping); err != nil {
		log.Errorf("Error updating provider user mapping registerCanvasUserLogin")
		return err
	}
	return nil
}

// create new user in canvas, return new user id
func (a accounts) createUserInCanvas(user module.User, providerId uint) (int, error) {
	provider, err := a.store.getProviderPlatformByID(int(providerId))
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
	resp, err := a.client.Do(request)
	if err != nil {
		log.Errorf("Error sending request to canvas createUserInCanvas")
		return 0, err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Error("Error closing response body createUserInCanvas")
		}
	}()
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
func (a accounts) createUserInKolibri(user module.User, prov *ProviderPlatform) error {
	if prov.AccountID == "TODO" {
		// here we check if this if this instance has been setup, if so we set the account id
		if err := a.checkKolibriAccountSetup(prov); err != nil {
			log.Error("error checking kolibri account setup")
			return err
		}
	}
	fields := log.Fields{"user_id": user.ID, "provider_platform_id": prov.ID}
	log.WithFields(fields).Info("creating user in kolibri")
	kUser := make(map[string]interface{}, 0)
	kUser["facility"] = prov.AccountID
	kUser["full_name"] = user.NameFirst + user.NameLast
	kUser["password"] = "NOT_SPECIFIED"
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
	resp, err := a.client.Do(request)
	if err != nil {
		log.Error("error sending request to kolibri for user creation")
		return err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Error("error closing response body for kolibri user creation")
		}
	}()
	var data map[string]any
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
	if !strings.Contains(id, "-") && len(id) > 20 {
		// add hyphens back to the uuid django strips out
		id = fmt.Sprintf("%s-%s-%s-%s-%s", id[:8], id[8:12], id[12:16], id[16:20], id[20:])
	}
	providerMapping := ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: prov.ID,
		ExternalUserID:     id,
		ExternalUsername:   user.Username,
	}
	if err := a.store.createProviderUserMapping(&providerMapping); err != nil {
		log.Error("error creating provider user mapping for kolibri user creation")
		return err
	}
	return nil
}

func (a accounts) checkKolibriAccountSetup(prov *ProviderPlatform) error {
	request, err := http.NewRequest(http.MethodGet, prov.BaseUrl+"/api/public/v1/facility/", nil)
	if err != nil {
		log.Error("error creating request for kolibri facility check")
		return err
	}
	resp, err := a.client.Do(request)
	if err != nil {
		log.Error("error sending request to kolibri for facility check")
		return err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Error("error closing response body for kolibri facility check")
		}
	}()
	if resp.StatusCode == http.StatusNotFound {
		log.Info("kolibri facility not found, creating")
		return errors.New(("kolibri facility or instance not found"))
	}
	body := make([]map[string]interface{}, 0)
	if err = json.NewDecoder(resp.Body).Decode(&body); err != nil {
		log.Error("error decoding response from kolibri facility check")
		return err
	}
	if len(body) == 0 {
		log.Info("kolibri facility not found")
		return errors.New("kolibri facility or instance not found")
	}
	first, ok := body[0]["id"].(string)
	if !ok {
		return errors.New("facility ID not found in Kolibri response")
	}
	return a.store.updateProviderAccountID(prov, first)
}
