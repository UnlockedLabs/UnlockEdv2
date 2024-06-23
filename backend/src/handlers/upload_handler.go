package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerImageRoutes() {
	srv.Mux.HandleFunc("POST /upload", srv.handleUploadHandler)
	srv.Mux.HandleFunc("GET /photos/{id}", srv.handleHostPhotos)
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request) {
	log.Info("Uploading file")
	logFields := log.Fields{
		"handler": "handleUploadHandler",
		"route":   "POST /upload",
	}
	if err := r.ParseMultipartForm(10 << 10); err != nil {
		log.WithFields(logFields).Error("Error parsing form: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		log.WithFields(logFields).Error("Error getting file: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get file")
		return
	}
	defer file.Close()
	logFields["filename"] = header.Filename

	path := filepath.Join("frontend", "public", "thumbnails", header.Filename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		log.WithFields(logFields).Error("Error opening file: ", err)
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	if _, err = io.Copy(f, file); err != nil {
		log.WithFields(logFields).Error("Error copying file: ", err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	url := os.Getenv("APP_URL") + "/photos/" + header.Filename
	response := map[string]string{"url": url}
	err = json.NewEncoder(w).Encode(&response)
	if err != nil {
		log.WithFields(logFields).Error("Error encoding response: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Error("Error writing response: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request) {
	img := r.PathValue("id")
	path := filepath.Join("frontend", "public", "thumbnails", img)
	http.ServeFile(w, r, path)
}
