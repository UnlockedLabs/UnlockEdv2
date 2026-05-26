package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strings"
)

// --- Types ---

type UserMatchResult struct {
	CanvasUser    models.ImportUser `json:"canvas_user"`
	SuggestedUser *models.User      `json:"suggested_user,omitempty"`
	Score         float64           `json:"score"`
}

type MatchUsersResponse struct {
	AutoConfirmed []UserMatchResult   `json:"auto_confirmed"`
	Ambiguous     []UserMatchResult   `json:"ambiguous"`
	Unmatched     []models.ImportUser `json:"unmatched"`
}

type ConfirmedMatch struct {
	CanvasUser     models.ImportUser `json:"canvas_user"`
	UnlockEdUserID uint              `json:"unlocked_user_id"`
}

type ApplyMatchesRequest struct {
	Confirmed []ConfirmedMatch    `json:"confirmed"`
	ToCreate  []models.ImportUser `json:"to_create"`
}

type ApplyMatchesResponse struct {
	Applied int      `json:"applied"`
	Created int      `json:"created"`
	Failed  []string `json:"failed"`
}

// --- Levenshtein ---

func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	la, lb := len(ra), len(rb)
	dp := make([][]int, la+1)
	for i := range dp {
		dp[i] = make([]int, lb+1)
		dp[i][0] = i
	}
	for j := 0; j <= lb; j++ {
		dp[0][j] = j
	}
	for i := 1; i <= la; i++ {
		for j := 1; j <= lb; j++ {
			if ra[i-1] == rb[j-1] {
				dp[i][j] = dp[i-1][j-1]
			} else {
				dp[i][j] = 1 + min(dp[i-1][j], min(dp[i][j-1], dp[i-1][j-1]))
			}
		}
	}
	return dp[la][lb]
}

func nameSimilarity(a, b string) float64 {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	if a == b {
		return 1.0
	}
	ra, rb := []rune(a), []rune(b)
	maxLen := len(ra)
	if len(rb) > maxLen {
		maxLen = len(rb)
	}
	if maxLen == 0 {
		return 1.0
	}
	return 1.0 - float64(levenshtein(a, b))/float64(maxLen)
}

// --- Matching logic ---

func matchUsers(canvasUsers []models.ImportUser, unlockEdUsers []models.User) MatchUsersResponse {
	result := MatchUsersResponse{
		AutoConfirmed: []UserMatchResult{},
		Ambiguous:     []UserMatchResult{},
		Unmatched:     []models.ImportUser{},
	}
	for _, cu := range canvasUsers {
		canvasName := cu.NameFirst + " " + cu.NameLast
		bestScore := 0.0
		var bestUser *models.User
		for i, u := range unlockEdUsers {
			score := nameSimilarity(canvasName, u.NameFirst+" "+u.NameLast)
			if score > bestScore {
				bestScore = score
				bestUser = &unlockEdUsers[i]
			}
		}
		switch {
		case bestScore >= 0.90:
			result.AutoConfirmed = append(result.AutoConfirmed, UserMatchResult{CanvasUser: cu, SuggestedUser: bestUser, Score: bestScore})
		case bestScore >= 0.50:
			result.Ambiguous = append(result.Ambiguous, UserMatchResult{CanvasUser: cu, SuggestedUser: bestUser, Score: bestScore})
		default:
			result.Unmatched = append(result.Unmatched, cu)
		}
	}
	return result
}

// --- Handlers ---

func (srv *Server) handleMatchUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}
	facilityID := srv.getFacilityID(r)

	canvasUsers, err := service.GetUsers()
	if err != nil {
		return newInternalServerServiceError(err, "error fetching provider users")
	}

	unlockEdUsers, err := srv.Db.GetAllUnmappedUsers(int(service.ProviderPlatformID), facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	result := matchUsers(canvasUsers, unlockEdUsers)
	return writeJsonResponse(w, http.StatusOK, result)
}

func (srv *Server) handleApplyMatches(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req ApplyMatchesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newBadRequestServiceError(err, "invalid request body")
	}

	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}

	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	if err != nil {
		return newDatabaseServiceError(err)
	}

	var failed []string
	applied := 0

	for _, c := range req.Confirmed {
		existing, _ := srv.Db.GetProviderUserMapping(int(c.UnlockEdUserID), int(service.ProviderPlatformID))
		if existing != nil {
			applied++
			continue
		}
		mapping := models.ProviderUserMapping{
			UserID:             c.UnlockEdUserID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   c.CanvasUser.ExternalUsername,
			ExternalUserID:     c.CanvasUser.ExternalUserID,
		}
		if err := srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			failed = append(failed, c.CanvasUser.Username)
			continue
		}
		if provider.OidcID != 0 {
			user, err := srv.Db.GetUserByID(c.UnlockEdUserID)
			if err != nil {
				log.errorf("could not fetch user %d for provider login registration: %v", c.UnlockEdUserID, err)
			} else if err := srv.registerProviderLogin(provider, user); err != nil {
				log.errorf("error registering provider login for user %d: %v", c.UnlockEdUserID, err)
			}
		}
		applied++
	}

	created := 0
	for _, cu := range req.ToCreate {
		if strings.TrimSpace(cu.Username) == "" && strings.TrimSpace(cu.Email) == "" && strings.TrimSpace(cu.NameLast) == "" {
			continue
		}
		newUser := models.User{
			Username:  cu.Username,
			Email:     cu.Email,
			NameFirst: cu.NameFirst,
			NameLast:  cu.NameLast,
		}
		if err := srv.WithUserContext(r).CreateUser(&newUser); err != nil {
			failed = append(failed, cu.Username)
			continue
		}
		tempPw, err := newUser.CreateTempPassword()
		if err != nil {
			log.errorf("error creating temp password for %s: %v", cu.Username, err)
		}
		if err := srv.HandleCreateUserKratos(newUser.Username, tempPw); err != nil {
			log.errorf("error creating kratos user for %s: %v", cu.Username, err)
		}
		mapping := models.ProviderUserMapping{
			UserID:             newUser.ID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   cu.ExternalUsername,
			ExternalUserID:     cu.ExternalUserID,
		}
		if err := srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			failed = append(failed, cu.Username)
			continue
		}
		if provider.OidcID != 0 {
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.errorf("error registering provider login for %s: %v", cu.Username, err)
			}
		}
		created++
	}

	if failed == nil {
		failed = []string{}
	}
	return writeJsonResponse(w, http.StatusOK, ApplyMatchesResponse{
		Applied: applied,
		Created: created,
		Failed:  failed,
	})
}
