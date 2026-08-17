package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"
)

func (srv *Server) registerLearningRecordRoutes() []routeDef {
	axx := models.LearningRecordAccess
	return []routeDef{
		featureRoute("GET /api/learning-record/facilities", srv.handleIndexLearningRecordFacilities, axx),
		featureRoute("GET /api/learning-record/entries", srv.handleIndexLearningRecordEntries, axx),
		featureRoute("POST /api/learning-record/entries", srv.handleCreateLearningRecordEntry, axx),
		featureRoute("PUT /api/learning-record/entries/{id}", srv.handleUpdateLearningRecordEntry, axx),
		featureRoute("DELETE /api/learning-record/entries/{id}", srv.handleDeleteLearningRecordEntry, axx),
		featureRoute("GET /api/learning-record/draft", srv.handleGetLearningRecordDraft, axx),
		featureRoute("PUT /api/learning-record/draft", srv.handleUpsertLearningRecordDraft, axx),
		featureRoute("DELETE /api/learning-record/draft", srv.handleDeleteLearningRecordDraft, axx),
	}
}

type learningRecordFacility struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// maxFacilityOtherRunes caps the free-text location. It prints as a single line
// on the transcript, and the column itself is unbounded text.
const maxFacilityOtherRunes = 120

/*
validateLearningRecordLocation normalizes and checks the achievement location on
an incoming entry or draft. The transcript treats facility_id and facility_other
as mutually exclusive alternatives, so that invariant is enforced here instead of
trusting the client, an unknown facility_id gets a 400 rather than a foreign key
error, and facility_name is replaced with the name on record so a client cannot
label a facility as something it is not.
*/
func (srv *Server) validateLearningRecordLocation(entry *models.LearningRecordEntry) error {
	// Whitespace-only text is the same as no text: the resident may have opened
	// the "Other" field and typed nothing meaningful into it yet.
	entry.FacilityOther = strings.TrimSpace(entry.FacilityOther)
	entry.FacilityName = ""
	if utf8.RuneCountInString(entry.FacilityOther) > maxFacilityOtherRunes {
		return newBadRequestServiceError(nil,
			fmt.Sprintf("location must be %d characters or fewer", maxFacilityOtherRunes))
	}
	if entry.FacilityID == nil {
		return nil
	}
	if entry.FacilityOther != "" {
		return newBadRequestServiceError(nil, "location must be either a facility or free text, not both")
	}
	name, ok, err := srv.Db.GetLearningRecordLocationFacility(*entry.FacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !ok {
		return newBadRequestServiceError(nil, "facility_id does not match a known facility")
	}
	entry.FacilityName = name
	return nil
}

// The main facilities routes are admin-only, so residents
// read the list through here, gated on the learning_record feature.
func (srv *Server) handleIndexLearningRecordFacilities(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilities, err := srv.Db.GetAllFacilitiesOrdered()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	results := make([]learningRecordFacility, 0, len(facilities))
	for _, facility := range facilities {
		results = append(results, learningRecordFacility{ID: facility.ID, Name: facility.Name})
	}
	return writeJsonResponse(w, http.StatusOK, results)
}

func (srv *Server) handleIndexLearningRecordEntries(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	entries, err := srv.Db.GetLearningRecordEntries(userID)
	if err != nil {
		log.add("user_id", userID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, entries)
}

func (srv *Server) handleCreateLearningRecordEntry(w http.ResponseWriter, r *http.Request, log sLog) error {
	var entry models.LearningRecordEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	entry.UserID = r.Context().Value(ClaimsKey).(*Claims).UserID
	if err := srv.validateLearningRecordLocation(&entry); err != nil {
		log.add("user_id", entry.UserID)
		return err
	}
	if err := srv.WithUserContext(r).CreateLearningRecordEntry(&entry); err != nil {
		log.add("user_id", entry.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, entry)
}

func (srv *Server) handleUpdateLearningRecordEntry(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "entry ID")
	}
	var entry models.LearningRecordEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	entry.ID = uint(id)
	entry.UserID = r.Context().Value(ClaimsKey).(*Claims).UserID
	if err := srv.validateLearningRecordLocation(&entry); err != nil {
		log.add("entry_id", id)
		log.add("user_id", entry.UserID)
		return err
	}
	if err := srv.WithUserContext(r).UpdateLearningRecordEntry(&entry); err != nil {
		log.add("entry_id", id)
		log.add("user_id", entry.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, entry)
}

func (srv *Server) handleDeleteLearningRecordEntry(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "entry ID")
	}
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	if err := srv.WithUserContext(r).DeleteLearningRecordEntry(uint(id), userID); err != nil {
		log.add("entry_id", id)
		log.add("user_id", userID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Entry deleted successfully")
}

func (srv *Server) handleGetLearningRecordDraft(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	draft, err := srv.Db.GetLearningRecordDraft(userID)
	if err != nil {
		log.add("user_id", userID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, draft)
}

func (srv *Server) handleUpsertLearningRecordDraft(w http.ResponseWriter, r *http.Request, log sLog) error {
	var draft models.LearningRecordEntry
	if err := json.NewDecoder(r.Body).Decode(&draft); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	draft.UserID = r.Context().Value(ClaimsKey).(*Claims).UserID
	if err := srv.validateLearningRecordLocation(&draft); err != nil {
		log.add("user_id", draft.UserID)
		log.add("client_id", draft.ClientID)
		return err
	}
	if err := srv.WithUserContext(r).UpsertLearningRecordDraft(&draft); err != nil {
		log.add("user_id", draft.UserID)
		log.add("client_id", draft.ClientID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, draft)
}

func (srv *Server) handleDeleteLearningRecordDraft(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		return newBadRequestServiceError(nil, "client_id query parameter is required")
	}
	if err := srv.WithUserContext(r).DeleteLearningRecordDraft(userID, clientID); err != nil {
		log.add("user_id", userID)
		log.add("client_id", clientID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Draft deleted successfully")
}
