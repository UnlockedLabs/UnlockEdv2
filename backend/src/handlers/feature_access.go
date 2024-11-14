package handlers

import (
	"UnlockEdv2/src/models"
	"errors"
	"net/http"
)

func (srv *Server) registerFeatureFlagRoutes() []routeDef {
	return []routeDef{
		{"PUT /api/auth/features/{feature}", srv.handleToggleFeatureFlag, true, models.Feature()},
	}
}

func (srv *Server) handleToggleFeatureFlag(w http.ResponseWriter, r *http.Request, log sLog) error {
	user := r.Context().Value(ClaimsKey).(*Claims)
	if user.Role != models.SystemAdmin {
		return newUnauthorizedServiceError()
	}
	feature := r.PathValue("feature")
	if !models.ValidFeature(models.FeatureAccess(feature)) {
		return newBadRequestServiceError(errors.New("feature_flag"), "invalid feature requested")
	}
	if err := srv.Db.ToggleFeatureAccess(feature); err != nil {
		return newInternalServerServiceError(err, "unable to toggle feature")
	}
	features, err := srv.Db.GetFeatureAccess()
	if err != nil {
		return newInternalServerServiceError(err, "unable to fetch features")
	}
	srv.features = features
	return writeJsonResponse(w, http.StatusOK, "feature toggled successfully")
}
