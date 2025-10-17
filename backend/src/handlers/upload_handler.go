package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var AllowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
}

func ValidatePathContainment(basePath, filename string) (string, error) {
	fullPath := filepath.Join(basePath, filename)
	absBase, err := filepath.Abs(basePath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve base path: %w", err)
	}
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve file path: %w", err)
	}
	if !strings.HasPrefix(absPath, absBase+string(filepath.Separator)) && absPath != absBase {
		return "", errors.New("path traversal detected: file path outside allowed directory")
	}
	return absPath, nil
}

func (srv *Server) registerImageRoutes() {
	// this route isn't behind the /api prefix because it is only called by middleware/internal services
	srv.Mux.Handle("POST /upload", srv.handleError(srv.handleUploadHandler))
	srv.Mux.Handle("GET /api/photos/{id}", srv.handleError(srv.handleHostPhotos))
}

func SanitizeFilename(filename string) (string, error) {
	if filename == "" {
		return "", errors.New("filename cannot be empty")
	}
	if len(filename) > 255 {
		return "", errors.New("filename exceeds maximum length of 255 characters")
	}
	if strings.Contains(filename, "\x00") {
		return "", errors.New("filename contains null byte")
	}
	base := filepath.Base(filepath.Clean(filename))
	if base == "." || base == ".." || base == "/" {
		return "", errors.New("invalid filename")
	}
	ext := strings.ToLower(filepath.Ext(base))
	if !AllowedExtensions[ext] {
		return "", fmt.Errorf("file extension %s not allowed, must be jpg, jpeg, png, gif, or webp", ext)
	}
	return base, nil
}

func (srv *Server) handleUploadHandler(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.info("Uploading file")
	file, header, err := r.FormFile("file")
	if err != nil {
		return newInternalServerServiceError(err, "Failed to get file")
	}
	log.add("filename", header.Filename)
	log.add("size", header.Size)
	defer func() {
		if file.Close() != nil {
			log.error("Failed to close file")
		}
	}()
	sanitizedFilename, err := SanitizeFilename(header.Filename)
	if err != nil {
		return newBadRequestServiceError(err, "Invalid filename")
	}
	basePath := os.Getenv("IMG_FILEPATH")
	path, err := ValidatePathContainment(basePath, sanitizedFilename)
	if err != nil {
		return newBadRequestServiceError(err, "Invalid file path")
	}
	log.add("sanitized_filename", sanitizedFilename)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return newInternalServerServiceError(err, "Failed to open file")
	}
	defer func() {
		if f.Close() != nil {
			log.error("Failed to close file")
		}
	}()
	if _, err = io.Copy(f, file); err != nil {
		return newInternalServerServiceError(err, "Failed to save file")
	}
	imgUrl := "/api/photos/" + sanitizedFilename
	return writeJsonResponse(w, http.StatusOK, map[string]string{"url": imgUrl})
}

func getImagePath(r *http.Request) (string, error) {
	img := r.PathValue("id")
	sanitizedFilename, err := SanitizeFilename(img)
	if err != nil {
		return "", err
	}
	basePath := os.Getenv("IMG_FILEPATH")
	return ValidatePathContainment(basePath, sanitizedFilename)
}

func (srv *Server) handleHostPhotos(w http.ResponseWriter, r *http.Request, log sLog) error {
	imagePath, err := getImagePath(r)
	if err != nil {
		return newBadRequestServiceError(err, "Invalid image path")
	}
	r.Header.Add("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "max-age=31536000")

	expires := time.Now().AddDate(1, 0, 0).Format(http.TimeFormat)
	w.Header().Set("Expires", expires)
	http.ServeFile(w, r, imagePath)
	return nil
}
