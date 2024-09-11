package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerImageRoutes() {
	srv.Mux.HandleFunc("POST /upload", srv.HandleError(srv.handleUploadHandler))
	srv.Mux.HandleFunc("GET /photos/{id}", srv.HandleError(srv.handleHostPhotos))
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request) error {
	log.Info("Uploading file")
	if err := r.ParseMultipartForm(10 << 10); err != nil {
		return newInternalServerServiceError(err, err.Error(), nil)
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		return newInternalServerServiceError(err, "Failed to get file", nil)
	}
	defer file.Close()

	path := filepath.Join(os.Getenv("IMG_FILEPATH"), header.Filename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		return newInternalServerServiceError(err, "Failed to open file", nil)
	}
	defer f.Close()

	if _, err = io.Copy(f, file); err != nil {
		return newInternalServerServiceError(err, "Failed to save file", nil)
	}
	url := os.Getenv("APP_URL") + "/photos/" + header.Filename
	response := map[string]string{"url": url}
	err = json.NewEncoder(w).Encode(&response)
	if err != nil {
		return newResponseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func getImagePath(r *http.Request) string {
	img := r.PathValue("id")
	if strings.Contains(img, "..") {
		return ""
	}
	return filepath.Join(os.Getenv("IMG_FILEPATH"), img)
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request) error {
	http.ServeFile(w, r, getImagePath(r))
	return nil
}
