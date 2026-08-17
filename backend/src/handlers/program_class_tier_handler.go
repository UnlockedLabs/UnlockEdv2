package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
)

var (
	errProgramRequired    = errors.New("program_id is required to create a class")
	errCohortFieldOnClass = errors.New("status, capacity and dates belong to a cohort, not a class -- update the cohort instead")
)

/*
id751 -- the CLASS tier: Program -> Class -> Cohort.

⚠️  Route naming. The two tiers are one URL segment apart, so read carefully.

	/api/classes/*         -> the CLASS tier (this file). Path param {id}.
	/api/program-classes/* -> COHORTS. Path param {cohort_id}.
	/api/programs/{id}/classes/* -> COHORTS under a program. Path param {cohort_id}.

	The API *paths* deliberately keep their original names: they are a published
	contract, and "cohort" is a backend-only word that must never surface to users.
	Only the path PARAMS were renamed to {cohort_id}, which is invisible to callers
	and makes the tier unambiguous at every handler that reads one.

	So: a path segment says "classes"; the param inside it says which tier it means.

	⚠️  There is NO id-based backstop. Class ids start at 1 and OVERLAP cohort ids in every
	environment (owner's call, 2026-08-17 -- migration §2.2 explains why). An earlier
	revision offset class ids to 1,000,000 so a cohort id passed as a class id would 404;
	that tripwire is gone, so a mixed-up id now resolves to a real row of the WRONG TIER.
	Read the param name and be sure which tier you are holding.
*/
func (srv *Server) registerProgramClassTierRoutes() []routeDef {
	axx := models.ProgramAccess
	classResolver := FacilityAdminResolver(models.TableNameClass, "id")
	return []routeDef{
		featureRoute("GET /api/classes", srv.handleIndexProgramClasses, axx),
		validatedFeatureRoute("GET /api/classes/{id}", srv.handleGetProgramClass, axx, classResolver),
		adminFeatureRoute("POST /api/classes", srv.handleCreateProgramClass, axx),
		adminValidatedFeatureRoute("PATCH /api/classes/{id}", srv.handleUpdateProgramClass, axx, classResolver),
	}
}

// handleIndexProgramClasses lists the class tier with its cohorts rolled up. Scoped to a
// program with ?program_id=, otherwise to the caller's facility.
func (srv *Server) handleIndexProgramClasses(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)

	if raw := r.URL.Query().Get("program_id"); raw != "" {
		programID, err := strconv.Atoi(raw)
		if err != nil {
			return newInvalidIdServiceError(err, "program_id")
		}
		classes, err := srv.Db.GetClassesForProgram(programID, &args)
		if err != nil {
			log.add("program_id", programID)
			return newDatabaseServiceError(err)
		}
		return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
	}

	classes, err := srv.Db.GetClassesForFacility(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

// handleGetProgramClass returns one class with its rollups, cohorts and credit types.
func (srv *Server) handleGetProgramClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	args := srv.getQueryContext(r)
	class, err := srv.Db.GetClassByID(id, &args)
	if err != nil {
		log.add("class_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, srv.withResolvedCreditTypes(class, &args))
}

// programClassRequest is the wire shape for create/update.
//
// CreditTypes is a POINTER to a slice on purpose, and the distinction is load-bearing:
//
//	omitted (nil)  -> leave the class's credit types alone
//	[]             -> CLEAR the override, so the class inherits its program's types
//	["Completion"] -> set an explicit override
//
// Collapsing nil and [] would make "inherit" unreachable through the API.
type programClassRequest struct {
	models.ProgramClass
	CreditTypes *[]models.CreditType `json:"credit_types"`
}

func (srv *Server) handleCreateProgramClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	var req programClassRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	facilityID, err := srv.requireFacilityID(r)
	if err != nil {
		return err
	}
	class := req.ProgramClass
	class.FacilityID = facilityID
	class.CreateUserID = models.UintPtr(r.Context().Value(ClaimsKey).(*Claims).UserID)

	if class.ProgramID == 0 {
		return newBadRequestServiceError(errProgramRequired, "program_id")
	}

	var creditTypes []models.CreditType
	if req.CreditTypes != nil {
		creditTypes = *req.CreditTypes
	}
	if err := srv.Db.CreateClass(&class, creditTypes); err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("class_id", class.ID)
	return writeJsonResponse(w, http.StatusCreated, class)
}

// handleUpdateProgramClass updates class-level fields only. Status, capacity and dates
// are cohort concerns and are rejected rather than silently ignored -- a caller sending
// them almost certainly means to update a cohort and should hear about it.
func (srv *Server) handleUpdateProgramClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}

	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	for _, cohortOnly := range []string{"status", "capacity", "start_dt", "end_dt"} {
		if _, present := raw[cohortOnly]; present {
			return newBadRequestServiceError(errCohortFieldOnClass, cohortOnly)
		}
	}

	updates := map[string]any{}
	for _, f := range []string{"name", "description", "credit_hours", "archived_at"} {
		if v, present := raw[f]; present {
			updates[f] = v
		}
	}
	updates["update_user_id"] = r.Context().Value(ClaimsKey).(*Claims).UserID

	var creditTypes []models.CreditType
	if v, present := raw["credit_types"]; present {
		encoded, err := json.Marshal(v)
		if err != nil {
			return newJSONReqBodyServiceError(err)
		}
		// non-nil even when empty, so "[]" reaches the DB layer as "clear the override"
		creditTypes = []models.CreditType{}
		if err := json.Unmarshal(encoded, &creditTypes); err != nil {
			return newJSONReqBodyServiceError(err)
		}
	}

	class, err := srv.Db.UpdateClass(id, updates, creditTypes)
	if err != nil {
		log.add("class_id", id)
		return newDatabaseServiceError(err)
	}
	log.add("class_id", id)
	return writeJsonResponse(w, http.StatusOK, class)
}

// withResolvedCreditTypes fills in the inherited credit types for display, so callers do
// not have to know the empty-means-inherit rule to render a class correctly.
func (srv *Server) withResolvedCreditTypes(class *models.ProgramClass, args *models.QueryContext) *models.ProgramClass {
	if len(class.CreditTypes) > 0 {
		return class
	}
	var programTypes []models.ProgramCreditType
	if err := srv.Db.WithContext(args.Ctx).
		Where("program_id = ?", class.ProgramID).
		Find(&programTypes).Error; err != nil {
		return class
	}
	inherited := make([]models.ProgramClassCreditType, 0, len(programTypes))
	for _, pt := range programTypes {
		inherited = append(inherited, models.ProgramClassCreditType{
			ClassID: class.ID, CreditType: pt.CreditType})
	}
	class.CreditTypes = inherited
	return class
}
