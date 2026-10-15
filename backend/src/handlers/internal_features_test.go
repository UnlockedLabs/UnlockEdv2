package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/UnlockedLabs/unlocked-core/backend/src/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleInternalFeatures(t *testing.T) {
	srv := newTestingServer()
	// Statewide defaults as a fresh install has them: learning_record and
	// ai_tutor off, everything else on.
	srv.features = []models.FeatureAccess{
		models.OpenContentAccess, models.RequestContentAccess, models.HelpfulLinksAccess, models.UploadVideoAccess,
		models.ProviderAccess,
		models.ProgramAccess, models.ResidentProgramsAccess,
	}
	srv.registerInternalRoutes()

	tests := []struct {
		name       string
		overrides  map[models.FeatureAccess]bool
		facilityID string // empty: use the facility created for this case
		wantStatus int
		want       []models.FeatureAccess
	}{
		{
			name:       "no overrides returns the statewide defaults",
			wantStatus: http.StatusOK,
			want:       srv.features,
		},
		{
			name:       "an override turns on a feature that is off statewide",
			overrides:  map[models.FeatureAccess]bool{models.LearningRecordAccess: true},
			wantStatus: http.StatusOK,
			want:       append([]models.FeatureAccess{models.LearningRecordAccess}, srv.features...),
		},
		{
			name:       "turning off a parent turns off its sub-features",
			overrides:  map[models.FeatureAccess]bool{models.OpenContentAccess: false},
			wantStatus: http.StatusOK,
			want:       []models.FeatureAccess{models.ProviderAccess, models.ProgramAccess, models.ResidentProgramsAccess},
		},
		{
			// Core reports a missing record as 400 (database.NewDBError).
			name:       "an unknown facility is rejected",
			facilityID: "999999",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "a non-numeric facility id is rejected",
			facilityID: "abc",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "a missing facility id is rejected",
			facilityID: "-",
			wantStatus: http.StatusBadRequest,
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			facility := models.Facility{Name: "Internal Features " + strconv.Itoa(i), Timezone: "America/Chicago"}
			require.NoError(t, srv.Db.Create(&facility).Error)
			args := models.QueryContext{Ctx: context.Background()}
			for feature, enabled := range tt.overrides {
				require.NoError(t, srv.Db.UpsertFacilityFeatureFlag(&args, facility.ID, feature, enabled, srv.features))
			}

			target := "/internal/v1/features?facility_id=" + strconv.Itoa(int(facility.ID))
			switch tt.facilityID {
			case "":
			case "-":
				target = "/internal/v1/features"
			default:
				target = "/internal/v1/features?facility_id=" + tt.facilityID
			}
			w := httptest.NewRecorder()
			srv.Mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))

			require.Equal(t, tt.wantStatus, w.Code, w.Body.String())
			if tt.wantStatus != http.StatusOK {
				return
			}
			var resp models.Resource[internalFeaturesResponse]
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
			assert.Equal(t, facility.ID, resp.Data.FacilityID)
			assert.ElementsMatch(t, tt.want, resp.Data.Features)
		})
	}
}
