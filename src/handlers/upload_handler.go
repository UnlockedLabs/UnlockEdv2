package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

func (srv *Server) registerImageRoutes() {
	srv.Mux.HandleFunc("POST /upload", srv.handleUploadHandler)
	srv.Mux.HandleFunc("GET /photos/{id}", srv.handleHostPhotos)
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request) {
	srv.LogInfo("Uploading file")
	if err := r.ParseMultipartForm(10 << 10); err != nil {
		srv.LogError("Error parsing form: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		srv.LogError("Error getting file: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get file")
		return
	}
	defer file.Close()

	path := filepath.Join("frontend", "public", "thumbnails", header.Filename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		srv.LogError("Error opening file: " + err.Error())
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	if _, err = io.Copy(f, file); err != nil {
		srv.LogError("Error saving file: " + err.Error())
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	url := os.Getenv("APP_URL") + "/photos/" + header.Filename
	response := map[string]string{"url": url}
	err = json.NewEncoder(w).Encode(&response)
	if err != nil {
		srv.LogError("Error encoding response: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.LogError("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request) {
	img := r.PathValue("id")
	path := filepath.Join("frontend", "public", "thumbnails", img)
	http.ServeFile(w, r, path)
}
