package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nats-io/nats.go"
)

func (srv *Server) registerLibraryRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/libraries", srv.handleIndexLibraries, false, axx},
		{"GET /api/libraries/{id}", srv.handleGetLibrary, false, axx},
		{"PUT /api/libraries/{id}", srv.handleToggleLibraryVisibility, true, axx},
	}
}

func (srv *Server) handleIndexLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	providerId, err := strconv.Atoi(r.URL.Query().Get("provider_id"))
	if err != nil {
		providerId = 0
	}
	showHidden := "visible"
	if !srv.UserIsAdmin(r) && r.URL.Query().Get("visibility") == "hidden" {
		return newUnauthorizedServiceError()
	}
	if srv.UserIsAdmin(r) {
		showHidden = r.URL.Query().Get("visibility")
	}
	total, libraries, err := srv.Db.GetAllLibraries(page, perPage, showHidden, search, providerId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, libraries, paginationData)
}

func (srv *Server) handleGetLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.Db.GetLibraryByID(id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, library)
}

func (srv *Server) handleToggleLibraryVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.Db.ToggleLibraryVisibility(id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	if srv.buckets != nil { //make sure to update value in bucket if exists
		libraryBucket := srv.buckets[LibraryPaths]
		updateLibraryBucket(libraryBucket, r.PathValue("id"), library, log)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}

func updateLibraryBucket(libraryBucket nats.KeyValue, key string, library models.Library, log sLog) {
	var proxyParams models.LibraryProxyPO
	entry, err := libraryBucket.Get(key)
	if err == nil {
		err = json.Unmarshal(entry.Value(), &proxyParams)
		if err != nil {
			log.warn("unable to unmarshal value from LibaryPaths bucket")
			return
		}
		proxyParams.VisibilityStatus = library.VisibilityStatus
	} else { //build a one for the bucket
		proxyParams = models.LibraryProxyPO{
			ID:                    library.ID,
			Path:                  library.Path,
			BaseUrl:               library.OpenContentProvider.BaseUrl,
			OpenContentProviderID: library.OpenContentProvider.ID,
			VisibilityStatus:      library.VisibilityStatus,
		}
	}
	marshaledParams, err := json.Marshal(proxyParams)
	if err != nil {
		log.warn("unable to marshal value to put into the LibaryPaths bucket")
		return
	}
	if _, err := libraryBucket.Put(key, marshaledParams); err != nil {
		log.warnf("unable to update value within LibaryPaths bucket, error is %v", err)
	}
}
