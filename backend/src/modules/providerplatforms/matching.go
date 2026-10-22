package providerplatforms

import (
	"sort"
	"strings"

	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
)

// --- Types ---

type UserMatchResult struct {
	CanvasUser    ImportUser `json:"canvas_user"`
	SuggestedUser *user      `json:"suggested_user,omitempty"`
	Score         float64    `json:"score"`
}

type MatchUsersResponse struct {
	AutoConfirmed []UserMatchResult `json:"auto_confirmed"`
	Ambiguous     []UserMatchResult `json:"ambiguous"`
	Unmatched     []ImportUser      `json:"unmatched"`
}

type ConfirmedMatch struct {
	CanvasUser     ImportUser `json:"canvas_user"`
	UnlockEdUserID uint       `json:"unlocked_user_id"`
}

type ApplyMatchesRequest struct {
	Confirmed []ConfirmedMatch `json:"confirmed"`
	ToCreate  []ImportUser     `json:"to_create"`
}

type ApplyMatchesResponse struct {
	Applied int      `json:"applied"`
	Created int      `json:"created"`
	Failed  []string `json:"failed"`
}

// --- Similarity metrics ---

var (
	jwMetric  = metrics.NewJaroWinkler()
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
func matchUsers(canvasUsers []ImportUser, unlockEdUsers []user) MatchUsersResponse {
	// Score every canvas×unlocked pair
	candidates := make([]matchCandidate, 0, len(canvasUsers)*len(unlockEdUsers))
	for ci, cu := range canvasUsers {
		canvasName := cu.NameFirst + " " + cu.NameLast
		for ui, u := range unlockEdUsers {
			score := nameSimilarity(canvasName, u.NameFirst+" "+u.NameLast)
			candidates = append(candidates, matchCandidate{ci, ui, score})
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		if candidates[i].canvasIdx != candidates[j].canvasIdx {
			return candidates[i].canvasIdx < candidates[j].canvasIdx
		}
		return candidates[i].unlockIdx < candidates[j].unlockIdx
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
		Unmatched:     []ImportUser{},
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
