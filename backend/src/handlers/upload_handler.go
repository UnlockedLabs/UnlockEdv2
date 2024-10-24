package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func (srv *Server) registerImageRoutes() {
	// this route isn't behind the /api prefix because it is only called by middleware/internal services
	srv.Mux.Handle("POST /upload", srv.handleError(srv.handleUploadHandler))
	srv.Mux.Handle("GET /api/photos/{id}", srv.handleError(srv.handleHostPhotos))
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.info("Uploading file")
	file, header, err := r.FormFile("file")
	if err != nil {
		return newInternalServerServiceError(err, "Failed to get file")
	}
	log.add("filename", header.Filename)
	log.add("size", header.Size)
	defer file.Close()
	path := filepath.Join(os.Getenv("IMG_FILEPATH"), header.Filename)
	log.add("filename", header.Filename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		return newInternalServerServiceError(err, "Failed to open file")
	}
	defer f.Close()
	if _, err = io.Copy(f, file); err != nil {
		return newInternalServerServiceError(err, "Failed to save file")
	}
	imgUrl, err := url.JoinPath(os.Getenv("APP_URL"), "/api/photos/", header.Filename)
	if err != nil {
		return newInternalServerServiceError(err, "Failed to generate url")
	}
	return writeJsonResponse(w, http.StatusOK, map[string]string{"url": imgUrl})
}

func getImagePath(r *http.Request) string {
	img := r.PathValue("id")
	if strings.Contains(img, "..") {
		return ""
	}
	return filepath.Join(os.Getenv("IMG_FILEPATH"), img)
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request, log sLog) error {
	http.ServeFile(w, r, getImagePath(r))
	return nil
}
