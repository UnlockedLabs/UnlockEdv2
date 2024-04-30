package handlers

import (
	"net/http"
	"os"
)

func (srv *Server) RegisterImageRoutes() {
	srv.Mux.HandleFunc("POST /upload", srv.UploadHandler)
	srv.Mux.HandleFunc("GET /photos/{img}", srv.HostPhotos)
}

func (srv *Server) UploadHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 5); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	data, _, err := r.FormFile("file")
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer data.Close()
	buffer := make([]byte, 10<<5)
	if _, err = data.Read(buffer); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	filename := r.FormValue("filename")
	if err = os.WriteFile("public/thumbnails/"+filename, buffer, 0666); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	url := os.Getenv("APP_URL") + "/photos/" + filename
	if err := srv.WriteResponse(w, http.StatusOK, "{\"url\":\""+url+"\"}"); err != nil {
		srv.LogError("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

func (srv *Server) HostPhotos(w http.ResponseWriter, r *http.Request) {
	img := r.PathValue("img")
	http.ServeFile(w, r, "public/thumbnails/"+img)
}
