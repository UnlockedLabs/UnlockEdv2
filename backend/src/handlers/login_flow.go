package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOidcFlowRoutes() {
	srv.Mux.Handle("POST /api/login", http.HandlerFunc(srv.handleLogin))
	srv.Mux.Handle("POST /api/logout", srv.applyMiddleware(srv.handleLogout))
	// srv.Mux.Handle("POST /api/consent/accept", srv.applyMiddleware(srv.handleConsent))
}

const (
	ConsentPutEndpoint = "/admin/oauth2/auth/requests/consent/accept?consent_challenge="
	ConsentGetEndpoint = "/admin/oauth2/auth/requests/consent?consent_challenge="
	LoginEndpoint      = "/admin/oauth2/auth/requests/login/accept"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var form LoginRequest
	err := json.NewDecoder(r.Body).Decode(&form)
	defer r.Body.Close()
	if err != nil {
		log.Error("Parsing form failed, using urlform" + err.Error())
	}
	if form.Username == "" || form.Password == "" {
		log.Errorf("Invalid form data, need username, password: %v", form)
		s.ErrorResponse(w, http.StatusBadRequest, "Invalid form data")
		return
	}
	if user, err := s.Db.AuthorizeUser(form.Username, form.Password); err == nil {
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
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString([]byte(os.Getenv("APP_KEY")))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "unlocked_token",
			Value:    signedToken,
			Expires:  time.Now().Add(24 * time.Hour),
			SameSite: http.SameSiteDefaultMode,
			HttpOnly: true,
			Secure:   true,
			Path:     "/",
		})
		s.WriteResponse(w, http.StatusOK, user)
		return
	} else {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
}

func (srv *Server) logoutCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		SameSite: http.SameSiteNoneMode,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	delete(orySessions, claims.UserID)
	s.logoutCookie(w)
	w.WriteHeader(http.StatusOK)
}

// func (s *Server) handleOidcLogin(w http.ResponseWriter, r *http.Request, claims Claims, challenge string) {
// 	log.Info("login challenge initiated")
//
// 	client := &http.Client{}
// 	body := map[string]interface{}{}
// 	body["subject"] = claims.Subject
// 	body["remember"] = true
// 	body["remember_for"] = 3600
// 	loginChallenge := "?login_challenge=" + challenge
// 	jsonBody, err := json.Marshal(body)
// 	if err != nil {
// 		log.Error("Error marshalling body")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	req, err := http.NewRequest("PUT", os.Getenv("HYDRA_ADMIN_URL")+LoginEndpoint+loginChallenge, bytes.NewReader(jsonBody))
// 	if err != nil {
// 		log.Error("Error creating request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	resp, err := client.Do(req)
// 	if err != nil {
// 		log.Error("Error sending request to hydra")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	defer resp.Body.Close()
// 	if resp.StatusCode != http.StatusOK {
// 		log.Error("Error accepting login request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	var loginResponse map[string]interface{}
// 	err = json.NewDecoder(resp.Body).Decode(&loginResponse)
// 	if err != nil {
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		log.Error("Error decoding response")
// 		return
// 	}
// 	redirectURI := loginResponse["redirect_to"].(string)
// 	log.Info("redirecting to", redirectURI)
// 	http.Redirect(w, r.WithContext(r.Context()), redirectURI, http.StatusSeeOther)
// }
//
// // Handle user consent to Oidc client accessing data on their behalf
// func (srv *Server) handleConsent(w http.ResponseWriter, r *http.Request) {
// 	log.Info("Client hit consent handler")
// 	reqBody := map[string]interface{}{}
// 	err := json.NewDecoder(r.Body).Decode(&reqBody)
// 	if err != nil {
// 		log.Error("Error decoding request body")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	consentChallenge, ok := reqBody["consent_challenge"].(string)
// 	if !ok {
// 		log.Error("Error getting consent challenge")
// 		srv.ErrorResponse(w, http.StatusBadRequest, "Consent challege not found")
// 		return
// 	}
// 	// first we need to get the info from ory about the client
// 	client := &http.Client{}
// 	request, err := http.NewRequest("GET", os.Getenv("HYDRA_ADMIN_URL")+ConsentGetEndpoint+consentChallenge, nil)
// 	if err != nil {
// 		log.Error("Error creating request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	request.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
// 	resp, err := client.Do(request)
// 	if err != nil {
// 		log.Error("Error sending request to hydra")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	defer resp.Body.Close()
// 	if resp.StatusCode != http.StatusOK {
// 		log.Error("Error getting consent request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	consentRequest := map[string]interface{}{}
// 	err = json.NewDecoder(resp.Body).Decode(&consentRequest)
// 	if err != nil {
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		log.Error("Error decoding response")
// 		return
// 	}
// 	challenge := consentRequest["challenge"].(string)
// 	log.Debugf("Consent challenge received from hydra: %v", challenge)
// 	body := make(map[string]interface{})
// 	body["grant_scope"] = []string{"openid", "offline", "profile", "email"}
// 	body["grant_access_token_audience"] = consentRequest["requested_access_token_audience"]
// 	body["remember"] = true
// 	body["remember_for"] = 3600
//
// 	jsonBody, err := json.Marshal(body)
// 	if err != nil {
// 		log.Error("Error marshalling body")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	req, err := http.NewRequest("PUT", os.Getenv("HYDRA_ADMIN_URL")+ConsentPutEndpoint+challenge, bytes.NewReader(jsonBody))
// 	if err != nil {
// 		log.Error("Error creating request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	req.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
// 	response, err := client.Do(req)
// 	if err != nil {
// 		log.Error("Error sending request to hydra")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	defer response.Body.Close()
// 	if resp.StatusCode != http.StatusOK {
// 		log.Error("Error accepting consent request")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	var consentResponse map[string]interface{}
// 	err = json.NewDecoder(response.Body).Decode(&consentResponse)
// 	if err != nil {
// 		log.Error("Error decoding response")
// 		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
// 		return
// 	}
// 	redirectURI := consentResponse["redirect_to"].(string)
// 	http.Redirect(w, r, redirectURI, http.StatusSeeOther)
// }
