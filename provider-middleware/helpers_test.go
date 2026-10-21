package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/opencontent"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// newTestDB returns an empty in-memory database with Open Content's tables.
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s_%d?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"), time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(opencontent.Module{}.TestModels()...); err != nil {
		t.Fatal(err)
	}
	return db
}

// fakeCore stands in for the server's thumbnail endpoints: HEAD
// /api/photos/{name} and POST /upload.
type fakeCore struct {
	*httptest.Server
	// photos are the thumbnail names that already exist.
	photos map[string]bool

	mu      sync.Mutex
	uploads []upload
}

// upload is one thumbnail posted to /upload.
type upload struct {
	Filename string
	Fields   map[string]string
	Size     int
}

// newFakeCore starts a fakeCore and points APP_URL at it.
func newFakeCore(t *testing.T, photos ...string) *fakeCore {
	t.Helper()
	fc := &fakeCore{photos: map[string]bool{}}
	for _, p := range photos {
		fc.photos[p] = true
	}
	mux := http.NewServeMux()
	mux.HandleFunc("HEAD /api/photos/{name}", func(w http.ResponseWriter, r *http.Request) {
		if !fc.photos[r.PathValue("name")] {
			w.WriteHeader(http.StatusNotFound)
		}
	})
	mux.HandleFunc("POST /upload", func(w http.ResponseWriter, r *http.Request) {
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer func() { _ = file.Close() }()
		fields := map[string]string{}
		for k, v := range r.MultipartForm.Value {
			fields[k] = v[0]
		}
		fc.mu.Lock()
		fc.uploads = append(fc.uploads, upload{Filename: header.Filename, Fields: fields, Size: int(header.Size)})
		fc.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":    map[string]string{"url": "/api/photos/" + header.Filename},
			"message": "uploaded",
		})
	})
	fc.Server = httptest.NewServer(mux)
	t.Cleanup(fc.Close)
	t.Setenv("APP_URL", fc.URL)
	return fc
}

func (fc *fakeCore) Uploads() []upload {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	return append([]upload(nil), fc.uploads...)
}

// image returns a fake image of n bytes.
func image(n int) []byte {
	return []byte(strings.Repeat("x", n))
}
