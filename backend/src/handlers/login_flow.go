package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOidcFlowRoutes() {
	srv.Mux.HandleFunc("POST /api/login", srv.handleLogin)
	srv.Mux.Handle("POST /api/logout", srv.applyMiddleware(srv.handleLogout))
	srv.Mux.Handle("POST /api/consent/accept", srv.applyMiddleware(srv.handleOidcConsent))
	srv.Mux.Handle("POST /api/auth/refresh", srv.applyMiddleware(srv.handleRefreshAuth))
}

const (
	LoginEndpoint       = "/self-service/login"
	ConsentPutEndpoint  = "/admin/oauth2/auth/requests/consent/accept"
	AcceptLoginEndpoint = "/admin/oauth2/auth/requests/login/accept"
	ConsentGetEndpoint  = "/admin/oauth2/auth/requests/consent?consent_challenge="
)

type LoginRequest struct {
	Username  string `json:"identifier"`
	Password  string `json:"password"`
	FlowID    string `json:"flow_id"`
	Challenge string `json:"challenge"`
	CsrfToken string `json:"csrf_token"`
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	resp := map[string]string{}
	resp["redirect_to"] = "/self-service/logout/browser"
	writeJsonResponse(w, http.StatusOK, resp)
}

// (oauth) login flow is semi complicated, so I will do my best to comment
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleLogin"}
	var form LoginRequest
	err := json.NewDecoder(r.Body).Decode(&form)
	defer r.Body.Close()
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Parsing form failed, using urlform")
	}
	fields["form"] = form
	// create json body to send to kratos for processing login
	jsonBody, err := buildKratosLoginForm(form)
	if err != nil {
		log.WithFields(fields).Error("Error marshalling body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	url := os.Getenv("KRATOS_PUBLIC_URL") + LoginEndpoint + "?flow=" + form.FlowID
	if form.Challenge != "" {
		// if there was an oauth2 code challenge, we append it to the kratos url
		url += "&login_challenge=" + form.Challenge
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error creating request")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	resp, err := s.submitKratosLoginRequest(form.CsrfToken, r, req)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error sending request to kratos")
		s.ErrorResponse(w, http.StatusUnauthorized, "Invalid login, unable to submit flow to kratos")
		return
	}
	// set the cookies from kratos to authenticate the client
	setLoginCookies(resp, w)
	redirect, err := getKratosRedirect(resp)
	if err != nil {
		log.WithFields(fields).Errorln("invalid login with kratos")
		s.ErrorResponse(w, resp.StatusCode, "Invalid login")
		return
	}
	writeJsonResponse(w, http.StatusOK, redirect)
}

func (srv *Server) submitKratosLoginRequest(token string, client, kratos *http.Request) (*http.Response, error) {
	// get the cookie from the client request and send it to kratos along w/
	// login form data, headers and the csrf token from the client
	cookie := client.Header.Get("Cookie")
	kratos.Header.Set("Cookie", cookie)
	kratos.Header.Set("X-CSRF-Token", token)
	kratos.Header.Set("Content-Type", "application/json")
	kratos.Header.Set("Accept", "application/json")
	return srv.Client.Do(kratos)
}

func buildKratosLoginForm(form LoginRequest) ([]byte, error) {
	if form.Username == "" || form.Password == "" {
		return nil, errors.New("username or password is empty")
	}
	body := map[string]interface{}{}
	body["identifier"] = form.Username
	body["password"] = form.Password
	body["method"] = "password"
	body["flow"] = form.FlowID
	body["csrf_token"] = form.CsrfToken
	return json.Marshal(body)
}

func getKratosRedirect(resp *http.Response) (map[string]string, error) {
	respBody := map[string]string{}
	decoded := map[string]interface{}{}
	var err error
	defer resp.Body.Close()
	if err = json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, err
	}
	switch resp.StatusCode {
	case 422:
		// kratos responds with a 422 if there was an oauth2 flow initiated
		// in that case, we need to redirect the user to the `redirect_browser_to` url
		respBody["redirect_to"] = decoded["redirect_browser_to"].(string)
	case 200:
		// successful login from kratos without oauth2
		session := decoded["session"].(map[string]interface{})
		identity := session["identity"].(map[string]interface{})
		traits := identity["traits"].(map[string]interface{})
		if traits["password_reset"].(bool) {
			respBody["redirect_to"] = "/reset-password"
		} else {
			respBody["redirect_to"] = "/dashboard"
		}
	default:
		return nil, errors.New("invalid login")
	}
	return respBody, nil
}

func setLoginCookies(resp *http.Response, w http.ResponseWriter) {
	for _, cookie := range resp.Cookies() {
		http.SetCookie(w, &http.Cookie{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Expires:  time.Now().Add(24 * time.Hour),
			SameSite: http.SameSiteNoneMode,
			HttpOnly: true,
			Secure:   true,
			Path:     "/",
		})
	}
}

func (s *Server) handleOidcConsent(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleOidcConsent"}
	// decode the request body, the client should have sent us the consent challenge
	// that they received from hydra along with the user's consent
	var decoded map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&decoded)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error decoding request body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()
	// get the user from the database
	user, err := s.Db.GetUserByID(s.GetUserID(r))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error getting user from db")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	consentChallenge := "?consent_challenge=" + decoded["consent_challenge"].(string)
	// build the consent body to send to hydra with info about the oauth2 identity token
	jsonBody, err := buildConsentBody(user)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error building consent body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	// send the consent request to hydra
	req, err := http.NewRequest(http.MethodPut, os.Getenv("HYDRA_ADMIN_URL")+ConsentPutEndpoint+consentChallenge, bytes.NewReader(jsonBody))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error creating request")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	// making sure to add the cookies, and relevant headers. If we don't add accept json
	// header, hydra will return a redirect automatically as if we were a browser
	response, err := s.sendAndDecodeOryRequest(r, req)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error sending request to hydra")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	log.Info("consent response: ", response)
	// send the client the redirect uri that hydra sent us
	redirectURI := response["redirect_to"].(string)
	respBody := map[string]string{
		"redirect_to": redirectURI,
	}
	writeJsonResponse(w, http.StatusOK, respBody)
}

func buildConsentBody(user *models.User) ([]byte, error) {
	body := make(map[string]interface{})
	body["remember"] = true
	body["grant_access_token_audience"] = []string{os.Getenv("APP_URL")}
	body["remember_for"] = 3600 * 24
	body["grant_scope"] = []string{"openid", "offline", "profile", "email"}
	body["session"] = map[string]interface{}{
		"access_token": map[string]interface{}{
			"scope": []string{"openid", "offline", "profile", "email"},
		},
		"id_token": map[string]string{
			// we use the username for all these fields, because different platforms
			// allow different field options by default, so we include a few just in case
			"nickname":           user.Username,
			"email":              user.Username,
			"preferred_username": user.Username,
			"locale":             "en",
		},
	}
	return json.Marshal(body)
}

func (srv *Server) sendAndDecodeOryRequest(client, req *http.Request) (map[string]interface{}, error) {
	req.Header.Add("Cookie", client.Header.Get("Cookie"))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorln("Error sending request to ory", err)
		return nil, err
	}
	defer resp.Body.Close()
	var responseBody map[string]interface{}
	return responseBody, json.NewDecoder(resp.Body).Decode(&responseBody)
}

// this endpoint is used when the user has an existing Kratos session, and is directed to
// oauth2 client login flow. Kratos by default will make the user login again despite
// acknowledging that the user has a session. So in this case, we skip kratos and accept
// the hydra login request directly because this endpoint sits behind auth middleware.
func (srv *Server) handleRefreshAuth(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleRefreshAuth"}
	var form map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&form)
	if err != nil {
		log.WithFields(fields).Error("Error decoding request body")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer r.Body.Close()
	session := form["session"].(map[string]interface{})
	toSend := map[string]interface{}{
		"identity_provider_session_id": session["id"].(string),
		"remember":                     true,
		"remember_for":                 3600 * 24,
		"subject":                      form["identity"].(string),
	}
	jsonBody, err := json.Marshal(toSend)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error marshalling body")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	url, err := acceptLoginEndpoint(form)
	if err == nil {
		srv.ErrorResponse(w, http.StatusContinue, "invalid request, must include challenge")
	}
	req, err := http.NewRequest(http.MethodPut, *url, bytes.NewReader(jsonBody))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error creating request")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	consentResponse, err := srv.sendAndDecodeOryRequest(r, req)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error creating request")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	writeJsonResponse(w, http.StatusOK, map[string]string{
		"redirect_to": consentResponse["redirect_to"].(string),
	})
}

func acceptLoginEndpoint(form map[string]interface{}) (*string, error) {
	challenge, ok := form["challenge"].(string)
	if !ok {
		return nil, errors.New("login refresh not sent with challenge, must revalidate password")
	}
	challenge = "?login_challenge=" + challenge
	endpoint := os.Getenv("HYDRA_ADMIN_URL") + AcceptLoginEndpoint + challenge
	return &endpoint, nil
}
