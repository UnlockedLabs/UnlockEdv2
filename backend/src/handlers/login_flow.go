package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOidcFlowRoutes() {
	srv.Mux.HandleFunc("POST /api/login", srv.handleLogin)
	srv.Mux.Handle("POST /api/logout", srv.applyMiddleware(srv.handleLogout))
	srv.Mux.Handle("POST /api/consent/accept", srv.applyMiddleware(srv.handleOidcConsent))
	srv.Mux.Handle("POST /api/auth/refresh", srv.applyMiddleware(srv.handleRefreshAuth))
}

const (
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

func (srv *Server) logoutCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "unlocked_token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		SameSite: http.SameSiteNoneMode,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.logoutCookie(w)
	resp := map[string]string{}
	resp["redirect_to"] = "/self-service/logout/browser"
	s.WriteResponse(w, http.StatusOK, resp)
}

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
	if form.Username == "" || form.Password == "" {
		log.WithFields(fields).Error("Invalid form data, need username, password")
		s.ErrorResponse(w, http.StatusBadRequest, "Invalid form data")
		return
	}
	cookie := r.Header.Get("Cookie")
	if user, err := s.Db.AuthorizeUser(form.Username, form.Password); err == nil {
		body := map[string]interface{}{}
		body["identifier"] = form.Username
		body["password"] = form.Password
		body["method"] = "password"
		body["flow"] = form.FlowID
		body["csrf_token"] = form.CsrfToken
		jsonBody, err := json.Marshal(body)
		if err != nil {
			log.WithFields(fields).Error("Error marshalling body")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		url := os.Getenv("KRATOS_PUBLIC_URL") + "/self-service/login?flow=" + form.FlowID
		if form.Challenge != "" {
			url += "&login_challenge=" + form.Challenge
		}
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(jsonBody))
		if err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Error("Error creating request")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Cookie", cookie)
		req.Header.Set("X-CSRF-Token", form.CsrfToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		resp, err := s.Client.Do(req)
		if err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Error("Error sending request to kratos")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		decoded := map[string]interface{}{}
		if err = json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Error("Error decoding response")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		respBody := map[string]string{}
		log.Debug("Decoded response from kratos", decoded)
		if resp.StatusCode == 422 {
			claims := getClaims(user)
			token := signToken(claims)
			setLoginCookies(resp, w, *token)
			respBody["redirect_to"] = decoded["redirect_browser_to"].(string)
			s.WriteResponse(w, http.StatusOK, respBody)
			return
		}
		claims := getClaims(user)
		token := signToken(claims)
		if token == nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		setLoginCookies(resp, w, *token)
		switch user.PasswordReset {
		case true:
			respBody["redirect_to"] = "/reset-password"
		default:
			respBody["redirect_to"] = "/dashboard"
		}
		s.WriteResponse(w, http.StatusOK, respBody)
		return
	} else {
		log.WithFields(fields).Error("Error authorizing user")
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
}

func getClaims(user *models.User) *Claims {
	claims := Claims{
		UserID:        user.ID,
		PasswordReset: user.PasswordReset,
		Role:          user.Role,
		FacilityID:    user.FacilityID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:  "admin",
			Subject: user.Username,
		},
	}
	return &claims
}

func signToken(claims *Claims) *string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(os.Getenv("APP_KEY")))
	if err != nil {
		return nil
	}
	return &signedToken
}

func setLoginCookies(resp *http.Response, w http.ResponseWriter, token string) {
	// set Ory cookies
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
	http.SetCookie(w, &http.Cookie{
		Name:     "unlocked_token",
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		SameSite: http.SameSiteDefaultMode,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
}

func (s *Server) handleOidcConsent(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleOidcConsent"}
	var decoded map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&decoded)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error decoding request body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()
	id := s.GetUserID(r)
	user, err := s.Db.GetUserByID(id)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error getting user from db")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	consentChallenge := "?consent_challenge=" + decoded["consent_challenge"].(string)
	jsonBody, err := buildConsentBody(user)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error building consent body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	req, err := http.NewRequest(http.MethodPut, os.Getenv("HYDRA_ADMIN_URL")+ConsentPutEndpoint+consentChallenge, bytes.NewReader(jsonBody))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error creating request")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	req.Header.Add("Cookie", r.Header.Get("Cookie"))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
	response, err := s.Client.Do(req)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error sending request to hydra")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer response.Body.Close()
	var consentResponse map[string]interface{}
	err = json.NewDecoder(response.Body).Decode(&consentResponse)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error decoding response")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	log.Info("consent response: ", consentResponse)
	redirectURI := consentResponse["redirect_to"].(string)
	respBody := map[string]string{
		"redirect_to": redirectURI,
	}
	s.WriteResponse(w, http.StatusOK, respBody)
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
			"nickname":           user.Username,
			"email":              user.Username,
			"preferred_username": user.Username,
			"locale":             "en",
		},
	}
	return json.Marshal(body)
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
	req.Header.Add("Cookie", r.Header.Get("Cookie"))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
	response, err := srv.Client.Do(req)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error sending request to hydra")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer response.Body.Close()
	var consentResponse map[string]interface{}
	err = json.NewDecoder(response.Body).Decode(&consentResponse)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Error decoding response")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	srv.WriteResponse(w, http.StatusOK, map[string]string{
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
