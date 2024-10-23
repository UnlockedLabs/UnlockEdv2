package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleUploadHandler(t *testing.T) {
	t.Setenv("IMG_FILEPATH", "test_data/uploadtrgt")
	t.Setenv("APP_URL", "http://127.0.0.1")
	httpTests := []httpTest{
		{"TestUploadHandlerAsAdmin", "admin", map[string]any{"uploadPath": "test_data/uploadsrc/20240808_124813.jpg", "cleanupPath": "test_data/uploadsrc/outsideart.jpg"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			fileName := "outsideart.jpg"
			sourcePath := test.mapKeyValues["uploadPath"].(string)
			sourceFile, err := os.Open(sourcePath)
			if err != nil {
				t.Fatal("unable to open file at the path ", sourcePath, " error is ", err)
			}
			defer sourceFile.Close()
			multipartBody := &bytes.Buffer{}
			multipartWriter := multipart.NewWriter(multipartBody)
			multipart, err := multipartWriter.CreateFormFile("file", fileName)
			if err != nil {
				t.Fatalf("unable to create multipart form file, error is %v", err)
			}
			_, err = io.Copy(multipart, sourceFile)
			if err != nil {
				t.Fatalf("unable to copy contents of sourceFile into multipart form file, error is %v", err)
			}
			err = multipartWriter.Close()
			if err != nil {
				t.Fatalf("unable to close mulitipart writer, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/upload", multipartBody)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.Header.Set("Content-Type", multipartWriter.FormDataContentType())
			handler := getHandlerByRole(server.handleUploadHandler, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.Resource[map[string]string]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if data.Data["url"] != os.Getenv("APP_URL")+"/api/photos/"+fileName {
				t.Error("unexpected response data returned for photos uploaded")
			}
			t.Cleanup(func() {
				err := os.Remove(filepath.Join(os.Getenv("IMG_FILEPATH"), fileName))
				if err != nil {
					t.Error("unable to clean up file that was uploaded, error is ", err)
				}
			})
		})
	}
}

func TestHandleHostPhotos(t *testing.T) {
	t.Setenv("IMG_FILEPATH", "test_data/uploadsrc")
	httpTests := []httpTest{
		{"TestHostPhotosAsAdmin", "admin", map[string]any{"id": "20240808_124813.jpg"}, http.StatusOK, ""},
		{"TestHostPhotosAsUser", "student", map[string]any{"id": "20240808_124813.jpg"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/photos/{id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleHostPhotos, test.role)
			rr := executeRequest(t, req, handler, test)
			if rr.Header().Get("Content-Type") != "image/jpeg" || rr.Header().Get("Content-Length") != "2165907" {
				t.Error("unexpected repsonse, we expected a photo to be served but did not get one")
			}
		})
	}
}
