package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/oauth2"
)

func (srv *Server) registerProviderPlatformRoutes() []routeDef {
	axx := models.ProviderAccess
	return []routeDef{
		adminFeatureRoute("GET /api/provider-platforms", srv.handleIndexProviders, axx),
		adminFeatureRoute("GET /api/provider-platforms/{id}", srv.handleShowProvider, axx),
		adminFeatureRoute("POST /api/provider-platforms", srv.handleCreateProvider, axx),
		adminFeatureRoute("GET /api/provider-platforms/callback", srv.handleOAuthProviderCallback, axx),
		adminFeatureRoute("GET /api/provider-platforms/{id}/refresh", srv.handleOAuthRefreshToken, axx),
		adminFeatureRoute("PATCH /api/provider-platforms/{id}", srv.handleUpdateProvider, axx),
		adminFeatureRoute("DELETE /api/provider-platforms/{id}", srv.handleDeleteProvider, axx),
	}
}

func (srv *Server) handleIndexProviders(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	platforms, err := srv.Db.GetAllProviderPlatforms(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	only := r.URL.Query().Get("only")
	if only == "oidc_enabled" {
		// this is for offering user creation in enabled providers
		platforms = slices.DeleteFunc(platforms, func(platform models.ProviderPlatform) bool {
			// don't return kolibri, as users are automatically created in kolibri
			return platform.OidcID == 0 || platform.Type == models.Kolibri
		})
	}
	slices.SortFunc(platforms, func(i, j models.ProviderPlatform) int {
		if i.State == models.Enabled && j.State != models.Enabled {
			return -1
		} else if i.State != models.Enabled && j.State == models.Enabled {
			return 1
		} else if i.State == models.Archived && j.State != models.Archived {
			return 1
		} else if i.State != models.Archived && j.State == models.Archived {
			return -1
		} else {
			return 0
		}
	})

	log.info("Found "+strconv.Itoa(int(args.Total)), " provider platforms")
	return writePaginatedResponse(w, http.StatusOK, platforms, args.IntoMeta())
}

func (srv *Server) handleShowProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("providerPlatformID", id)
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *platform)
}

func (srv *Server) handleCreateProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	var platform models.ProviderPlatform
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if platform.Type == models.Brightspace {
		oauthURL, err := srv.getOAuthUrl(&platform)
		if err != nil {
			return err
		}
		return writeJsonResponse(w, http.StatusCreated, map[string]interface{}{
			"platform":  platform,
			"oauth2Url": oauthURL,
		})
	}
	err = srv.WithUserContext(r).CreateProviderPlatform(&platform)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, map[string]interface{}{
		"platform": platform,
	})
}

// if errors occur within this handler they will be handled by passing the message and status via query parameters
// in the redirect url, therefore this method will only return nil as its error
func (srv *Server) handleOAuthProviderCallback(w http.ResponseWriter, r *http.Request, log sLog) error {
	const (
		successRedirectUrl = "/learning-platforms?status=success&message=Provider platform %s successfully"
		errorRedirectUrl   = "/learning-platforms?status=error&message=Failed to configure provider platform"
	)
	stateFromClient := r.FormValue("state")
	if stateFromClient == "" { //state is an opaque value used by the client to maintain state between the request and callback
		log.error("state value not found from oauth provider, unable to process request") //error
		http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
		return nil
	}
	oauthBucket := srv.buckets[OAuthState] //bucket will exist here
	entry, err := oauthBucket.Get(stateFromClient)
	if err != nil {
		log.errorf("invalid oauth state value found from oauth provider and UnlockEd, state value found %s", stateFromClient)
		http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
		return nil
	}
	var provider models.ProviderPlatform
	err = json.Unmarshal(entry.Value(), &provider)
	if err != nil {
		log.errorf("unable to unmarshal value from bucket, error is %s", err)
		http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
		return nil
	}
	log.info("Deleting provider platform from bucket")
	if err := oauthBucket.Delete(stateFromClient); err != nil {
		log.errorf("unable to delete entry in bucket, error is %s", err) //error
	}
	code := r.FormValue("code")
	config := provider.GetOAuth2Config()
	token, err := config.Exchange(context.Background(), code) // Exchange the authorization code for an access token
	if err != nil {
		log.errorf("unable to make oauth token exchange with provider platform, error is %s", err) //error
		http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
		return nil
	}
	//verfying that the BaseUrl used is correct and checking user role
	apiURL := fmt.Sprintf("%s/d2l/api/lp/%s/dataExport/bds/list", provider.BaseUrl, models.BrightspaceApiVersion)
	client := config.Client(context.Background(), token)
	resp, err := client.Get(apiURL)
	if err != nil || resp.StatusCode != http.StatusOK {
		log.errorf("unable to execute api call, most likely due to provider BaseUrl %s not being correct, error is %s", provider.BaseUrl, err) //error
		http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
		return nil
	}
	provider.AccessKey = config.ClientSecret + ";" + token.RefreshToken
	var action string
	if provider.ID > 0 {
		if _, err := srv.WithUserContext(r).UpdateProviderPlatform(&provider, provider.ID); err != nil {
			log.errorf("unable to update provider platform, error is %s", err) //error
			http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
			return nil
		}
		action = "updated"
	} else {
		if err := srv.WithUserContext(r).CreateProviderPlatform(&provider); err != nil {
			log.errorf("unable to save provider platform, error is %s", err) //error
			http.Redirect(w, r, errorRedirectUrl, http.StatusTemporaryRedirect)
			return nil
		}
		action = "created"
	}
	http.Redirect(w, r, fmt.Sprintf(successRedirectUrl, action), http.StatusTemporaryRedirect)
	return nil
}

func (srv *Server) handleOAuthRefreshToken(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("provider_platform_id", id)
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	oauthURL, err := srv.getOAuthUrl(platform)
	if err != nil {
		return err
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"oauth2Url": oauthURL,
	})
}

func (srv *Server) handleUpdateProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("provider_platform_id", id)
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	dbWithCtx := srv.WithUserContext(r)

	if platform.BaseUrl != "" || platform.AccessKey != "" || platform.AccountID != "" || (platform.State != "" && platform.State == models.Enabled) {
		existingPlatform, err := dbWithCtx.GetProviderPlatformByID(id)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if existingPlatform.Type == models.Brightspace && (platform.State == models.Enabled || existingPlatform.State == models.Enabled) {
			models.UpdateStruct(&existingPlatform, &platform)
			oauthURL, err := srv.getOAuthUrl(existingPlatform)
			if err != nil {
				return err
			}
			return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
				"platform":  existingPlatform,
				"oauth2Url": oauthURL,
			})
		}
	}
	updated, err := dbWithCtx.UpdateProviderPlatform(&platform, uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"platform": *updated,
	})
}

func (srv *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("providerPlatformId", id)
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Provider platform deleted successfully")
}

func (srv *Server) getOAuthUrl(platform *models.ProviderPlatform) (string, error) {
	var (
		brightspaceConfig = platform.GetOAuth2Config()
		oauthState        = models.CreateOAuth2UrlState()
		oauthURL          string
	)
	if !strings.HasPrefix(brightspaceConfig.RedirectURL, "https") {
		return oauthURL, newInternalServerServiceError(errors.New("web server does not use proper scheme https"), "Server not configured to use https scheme, unable to process oauth2 flow.")
	}
	if srv.buckets == nil {
		return oauthURL, newInternalServerServiceError(errors.New("server not configured with NATS KeyValue buckets"), "Server not configured with buckets, unable to process oauth2 flow.")
	}
	oauthBucket := srv.buckets[OAuthState]
	platformBytes, err := json.Marshal(platform) //temporarily put provider platform in bucket to process in callback.
	if err != nil {
		return oauthURL, newInternalServerServiceError(err, "unable to marshal platform")
	}
	if _, err := oauthBucket.Put(oauthState, platformBytes); err != nil {
		return oauthURL, newInternalServerServiceError(err, "could not add platform to bucket")
	}
	oauthURL = brightspaceConfig.AuthCodeURL(oauthState, oauth2.AccessTypeOffline)
	return oauthURL, nil
}
