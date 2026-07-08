package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

func (srv *Server) registerFacilityFeatureRoutes() []routeDef {
	return []routeDef{
		// dept + system admins (canSwitchFacility) manage any facility's features
		newDeptAdminRoute("GET /api/facilities/features", srv.handleGetFacilitiesFeatureStatus),
		newDeptAdminRoute("GET /api/facilities/{id}/features", srv.handleGetFacilityFeatureDetail),
		newDeptAdminRoute("PUT /api/facilities/{id}/features/{feature}", srv.handleToggleFacilityFeature),
	}
}

/*
GET: /api/facilities/features
Overview list of every facility with the effective on/off state of each
manageable, globally-enabled top-level feature + an "enabled of total" count.
Optional filter query params: feature=<key>&enabled=<true|false> (both required
to filter). Paginated by facility (page, per_page).
*/
func (srv *Server) handleGetFacilitiesFeatureStatus(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	q := r.URL.Query()

	var filterFeature *models.FeatureAccess
	if fv := q.Get("feature"); fv != "" {
		fa := models.FeatureAccess(fv)
		if !models.ValidFeature(fa) {
			return newBadRequestServiceError(errors.New("invalid feature"), "invalid feature filter")
		}
		filterFeature = &fa
	}
	var filterEnabled *bool
	if ev := q.Get("enabled"); ev != "" {
		b, err := strconv.ParseBool(ev)
		if err != nil {
			return newBadRequestServiceError(err, "invalid enabled filter")
		}
		filterEnabled = &b
	}

	total, statuses, err := srv.Db.GetAllFacilitiesFeatureStatus(page, perPage, filterFeature, filterEnabled)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, statuses, models.NewPaginationInfo(page, perPage, total))
}

/*
GET: /api/facilities/{id}/features
Right-panel detail for one facility: each manageable top-level feature with its
page sub-features nested underneath.
*/
func (srv *Server) handleGetFacilityFeatureDetail(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facility_id", id)
	detail, err := srv.Db.GetFacilityFeatureDetail(uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, detail)
}

type toggleFacilityFeatureRequest struct {
	Enabled bool `json:"enabled"`
}

/*
PUT: /api/facilities/{id}/features/{feature}
Sets the enabled state of a single feature (top-level or page) for one facility.
Body: { "enabled": bool }. Layering/parent guards are enforced in the DB layer.
*/
func (srv *Server) handleToggleFacilityFeature(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	feature := models.FeatureAccess(r.PathValue("feature"))
	if !models.ValidFeature(feature) {
		return newBadRequestServiceError(errors.New("feature flag invalid"), "invalid feature was requested")
	}
	var body toggleFacilityFeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	log.add("facility_id", id)
	log.add("feature", string(feature))
	log.add("enabled", body.Enabled)

	if err := srv.WithUserContext(r).ToggleFacilityFeature(uint(id), feature, body.Enabled); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "facility feature toggled successfully")
}
