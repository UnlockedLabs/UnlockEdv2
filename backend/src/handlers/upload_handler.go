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
	srv.Mux.HandleFunc("POST /upload", srv.handleUploadHandler)
	srv.Mux.HandleFunc("GET /photos/{id}", srv.handleHostPhotos)
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request) {
	log.Info("Uploading file")
	if err := r.ParseMultipartForm(10 << 10); err != nil {
		log.Error("Error parsing form: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		log.Error("Error getting file: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get file")
		return
	}
	defer file.Close()

	path := filepath.Join(os.Getenv("IMG_FILEPATH"), header.Filename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		log.Error("Error opening file: " + err.Error())
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	if _, err = io.Copy(f, file); err != nil {
		log.Error("Error saving file: " + err.Error())
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	url := os.Getenv("APP_URL") + "/photos/" + header.Filename
	response := map[string]string{"url": url}
	err = json.NewEncoder(w).Encode(&response)
	if err != nil {
		log.Error("Error encoding response: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusOK, response)
}

func getImagePath(r *http.Request) string {
	img := r.PathValue("id")
	if strings.Contains(img, "..") {
		return ""
	}
	return filepath.Join(os.Getenv("IMG_FILEPATH"), img)
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, getImagePath(r))
}
