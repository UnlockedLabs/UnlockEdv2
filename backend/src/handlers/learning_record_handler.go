package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerLearningRecordRoutes() []routeDef {
	axx := models.LearningRecordAccess
	return []routeDef{
		featureRoute("GET /api/learning-record/entries", srv.handleIndexLearningRecordEntries, axx),
		featureRoute("POST /api/learning-record/entries", srv.handleCreateLearningRecordEntry, axx),
		featureRoute("PUT /api/learning-record/entries/{id}", srv.handleUpdateLearningRecordEntry, axx),
		featureRoute("DELETE /api/learning-record/entries/{id}", srv.handleDeleteLearningRecordEntry, axx),
		featureRoute("GET /api/learning-record/draft", srv.handleGetLearningRecordDraft, axx),
		featureRoute("PUT /api/learning-record/draft", srv.handleUpsertLearningRecordDraft, axx),
		featureRoute("DELETE /api/learning-record/draft", srv.handleDeleteLearningRecordDraft, axx),
	}
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
	if err := srv.Db.CreateLearningRecordEntry(&entry); err != nil {
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
	if err := srv.Db.UpdateLearningRecordEntry(&entry); err != nil {
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
	if err := srv.Db.DeleteLearningRecordEntry(uint(id), userID); err != nil {
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
	if err := srv.Db.UpsertLearningRecordDraft(&draft); err != nil {
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
	if err := srv.Db.DeleteLearningRecordDraft(userID, clientID); err != nil {
		log.add("user_id", userID)
		log.add("client_id", clientID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Draft deleted successfully")
}
