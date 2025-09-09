package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"errors"
	"net/http"
)

func (srv *Server) registerFeatureFlagRoutes() []routeDef {
	return []routeDef{
		newAdminRoute("PUT /api/auth/features/{feature}", srv.handleToggleFeatureFlag),
		newAdminRoute("PUT /api/auth/page-features/{feature}", srv.handleTogglePageFeatureFlag),
		validatedAdminRoute("POST /api/auth/demo-seed", srv.handleRunDemoSeed, func(db *database.DB, r *http.Request) bool {
			return userIsSystemAdmin(r)
		}),
	}
}

func (srv *Server) handleToggleFeatureFlag(w http.ResponseWriter, r *http.Request, log sLog) error {
	return srv.toggleFeature(w, r, log, srv.Db.ToggleFeatureAccess, "feature toggled successfully")
}

func (srv *Server) handleTogglePageFeatureFlag(w http.ResponseWriter, r *http.Request, log sLog) error {
	return srv.toggleFeature(w, r, log, srv.Db.TogglePageFeature, "page feature toggled successfully")
}

func (srv *Server) toggleFeature(w http.ResponseWriter, r *http.Request, log sLog, toggleFeatureAccess func(string) error, successMessage string) error {
	user := r.Context().Value(ClaimsKey).(*Claims)
	if user.Role != models.SystemAdmin {
		return newUnauthorizedServiceError()
	}

	feature := r.PathValue("feature")
	log.add("feature", feature)

	if !models.ValidFeature(models.FeatureAccess(feature)) {
		return newBadRequestServiceError(errors.New("feature flag invalid"), "invalid feature was requested")
	}

	if err := toggleFeatureAccess(feature); err != nil {
		return newInternalServerServiceError(err, "unable to toggle feature")
	}

	features, err := srv.Db.GetFeatureAccess()
	if err != nil {
		return newInternalServerServiceError(err, "unable to fetch features")
	}
	srv.features = features

	return writeJsonResponse(w, http.StatusOK, successMessage)
}

func (srv *Server) handleRunDemoSeed(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.info("running seeder for demo environment")
	err := srv.Db.RunOrResetDemoSeed(srv.getFacilityID(r))
	if err != nil {
		return newInternalServerServiceError(err, "unable to run demo seed")
	}
	return writeJsonResponse(w, http.StatusOK, "demo seed ran successfully")
}
