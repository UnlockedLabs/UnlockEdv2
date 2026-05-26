package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
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

// --- Similarity metrics ---

var (
	jwMetric = metrics.NewJaroWinkler()
	swgMetric = func() *metrics.SmithWatermanGotoh {
		swg := metrics.NewSmithWatermanGotoh()
		swg.CaseSensitive = false
		swg.GapPenalty = -0.1
		swg.Substitution = metrics.MatchMismatch{Match: 1, Mismatch: -0.5}
		return swg
	}()
)

// nameSimilarity returns a composite score (0–1) combining Jaro-Winkler (60%)
// and Smith-Waterman-Gotoh (40%). JW is weighted higher because it is designed
// for person names; SWG adds sensitivity to partial/substring matches.
func nameSimilarity(a, b string) float64 {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	jw := strutil.Similarity(a, b, jwMetric)
	swg := strutil.Similarity(a, b, swgMetric)
	return 0.6*jw + 0.4*swg
}

// --- Matching logic ---

type matchCandidate struct {
	canvasIdx int
	unlockIdx int
	score     float64
}

// matchUsers performs greedy 1:1 matching. All pairs are scored, sorted by
// score descending, then assigned greedily — each Canvas user and each
// UnlockEd user can only appear in one match.
func matchUsers(canvasUsers []models.ImportUser, unlockEdUsers []models.User) MatchUsersResponse {
	// Score every canvas×unlocked pair
	candidates := make([]matchCandidate, 0, len(canvasUsers)*len(unlockEdUsers))
	for ci, cu := range canvasUsers {
		canvasName := cu.NameFirst + " " + cu.NameLast
		for ui, u := range unlockEdUsers {
			score := nameSimilarity(canvasName, u.NameFirst+" "+u.NameLast)
			candidates = append(candidates, matchCandidate{ci, ui, score})
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	assignedCanvas := make([]bool, len(canvasUsers))
	assignedUnlock := make([]bool, len(unlockEdUsers))
	bestForCanvas := make([]matchCandidate, len(canvasUsers))

	for _, c := range candidates {
		if assignedCanvas[c.canvasIdx] || assignedUnlock[c.unlockIdx] {
			continue
		}
		if c.score < 0.50 {
			break // remaining candidates all score below threshold
		}
		assignedCanvas[c.canvasIdx] = true
		assignedUnlock[c.unlockIdx] = true
		bestForCanvas[c.canvasIdx] = c
	}

	result := MatchUsersResponse{
		AutoConfirmed: []UserMatchResult{},
		Ambiguous:     []UserMatchResult{},
		Unmatched:     []models.ImportUser{},
	}
	for ci, cu := range canvasUsers {
		if !assignedCanvas[ci] {
			result.Unmatched = append(result.Unmatched, cu)
			continue
		}
		c := bestForCanvas[ci]
		mr := UserMatchResult{CanvasUser: cu, SuggestedUser: &unlockEdUsers[c.unlockIdx], Score: c.score}
		if c.score >= 0.90 {
			result.AutoConfirmed = append(result.AutoConfirmed, mr)
		} else {
			result.Ambiguous = append(result.Ambiguous, mr)
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
