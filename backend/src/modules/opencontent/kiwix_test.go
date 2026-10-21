package opencontent

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// kiwixFeed is a catalog in Kiwix's format. The summaries hold a raw "&",
// which Kiwix sends unescaped, next to an escaped one.
const kiwixFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>urn:uuid:a</id>
    <title>Wikipedia</title>
    <summary>Tom &amp; Jerry & friends</summary>
    <language>eng</language>
    <link rel="http://opds-spec.org/image/thumbnail" href="/catalog/v2/illustration/a/?size=48" type="image/png;width=48;height=48;scale=1"/>
    <link type="text/html" href="/content/wikipedia_en"/>
  </entry>
  <entry>
    <id>urn:uuid:b</id>
    <title>Gutenberg</title>
    <summary>Books</summary>
    <language>eng</language>
    <link rel="http://opds-spec.org/image/thumbnail" href="/catalog/v2/illustration/b/?size=48" type="image/png;width=48;height=48;scale=1"/>
    <link type="text/html" href="/content/gutenberg_en"/>
  </entry>
  <entry>
    <id>urn:uuid:c</id>
    <title>Tiny</title>
    <summary>Small icon</summary>
    <language>fra</language>
    <link rel="http://opds-spec.org/image/thumbnail" href="/catalog/v2/illustration/c/?size=48" type="image/png;width=48;height=48;scale=1"/>
    <link type="text/html" href="/content/tiny_fr"/>
  </entry>
</feed>`

// newFakeKiwix serves feed as the catalog, a 200-byte thumbnail for every
// library except "c", whose thumbnail is too small to keep.
func newFakeKiwix(t *testing.T, feed string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /catalog/v2/entries", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "lang=eng&start=0&count=1000" {
			t.Errorf("catalog query = %q", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(feed))
	})
	mux.HandleFunc("GET /catalog/v2/illustration/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/catalog/v2/illustration/c/") {
			_, _ = w.Write(image(MinImgSize - 1))
			return
		}
		_, _ = w.Write(image(200))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func kiwixProvider(id uint, url string) *OpenContentProvider {
	p := &OpenContentProvider{Url: url}
	p.ID = id
	return p
}

func library(providerID uint, externalID, title string) *Library {
	return &Library{
		OpenContentProviderID: providerID,
		ExternalID:            &externalID,
		Title:                 title,
		Url:                   "/old",
	}
}

func TestImportLibraries(t *testing.T) {
	db := newTestDB(t)
	core := newFakeCore(t, "Wikipedia.png")
	kiwix := newFakeKiwix(t, kiwixFeed)

	existing := library(1, "urn:uuid:a", "Old title")
	gone := library(1, "urn:uuid:gone", "Removed from Kiwix")
	otherProvider := library(2, "urn:uuid:other", "Another provider's")
	for _, lib := range []*Library{existing, gone, otherProvider} {
		if err := db.Create(lib).Error; err != nil {
			t.Fatal(err)
		}
	}

	ks := NewKiwixService(kiwixProvider(1, kiwix.URL), map[string]any{"job_id": "job-1"})
	if err := ks.ImportLibraries(context.Background(), db); err != nil {
		t.Fatalf("ImportLibraries: %v", err)
	}

	var libs []Library
	if err := db.Order("id").Find(&libs).Error; err != nil {
		t.Fatal(err)
	}
	type row struct {
		id                                                uint
		provider                                          uint
		externalID, title, url, thumbnail, desc, language string
	}
	var got []row
	for _, l := range libs {
		got = append(got, row{l.ID, l.OpenContentProviderID, *l.ExternalID, l.Title, l.Url, deref(l.ThumbnailUrl), deref(l.Description), deref(l.Language)})
	}
	want := []row{
		// Updated in place, keeping its ID. Its thumbnail already existed.
		{existing.ID, 1, "urn:uuid:a", "Wikipedia", "/content/wikipedia_en", "/api/photos/Wikipedia.png", "Tom & Jerry & friends", "eng"},
		// Untouched: it belongs to another provider.
		{otherProvider.ID, 2, "urn:uuid:other", "Another provider's", "/old", "", "", ""},
		// New, with its thumbnail uploaded to core.
		{otherProvider.ID + 1, 1, "urn:uuid:b", "Gutenberg", "/content/gutenberg_en", "/api/photos/Gutenberg.png", "Books", "eng"},
		// New. Its thumbnail was too small, so it gets Kiwix's logo.
		{otherProvider.ID + 2, 1, "urn:uuid:c", "Tiny", "/content/tiny_fr", "/kiwix.jpg", "Small icon", "fra"},
	}
	if len(got) != len(want) {
		t.Fatalf("libraries = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("library %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	// The library Kiwix no longer lists is soft-deleted.
	var deleted Library
	if err := db.Unscoped().First(&deleted, gone.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !deleted.DeletedAt.Valid {
		t.Error("the library missing from the catalog wasn't deleted")
	}

	// Thumbnails are named after the library's title, not its ID.
	uploads := core.Uploads()
	if len(uploads) != 1 {
		t.Fatalf("uploads = %+v, want only Gutenberg's", uploads)
	}
	wantFields := map[string]string{"filename": "Gutenberg.png", "size": "200", "type": "image/png"}
	if u := uploads[0]; u.Filename != "Gutenberg.png" || u.Size != 200 || !equalMaps(u.Fields, wantFields) {
		t.Errorf("upload = %+v, want Gutenberg.png, 200 bytes, fields %v", u, wantFields)
	}
}

// A catalog that can't be read or parsed fails the job and deletes nothing.
func TestImportLibrariesFailure(t *testing.T) {
	tests := []struct {
		name string
		feed string
		down bool
	}{
		{name: "kiwix down", down: true},
		{name: "bad xml", feed: "<feed><entry>"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			newFakeCore(t)
			kiwix := newFakeKiwix(t, tt.feed)
			if tt.down {
				kiwix.Close()
			}
			lib := library(1, "urn:uuid:a", "Wikipedia")
			if err := db.Create(lib).Error; err != nil {
				t.Fatal(err)
			}

			ks := NewKiwixService(kiwixProvider(1, kiwix.URL), map[string]any{"job_id": "job-1"})
			if err := ks.ImportLibraries(context.Background(), db); err == nil {
				t.Fatal("ImportLibraries succeeded, want an error")
			}
			var n int64
			if err := db.Model(&Library{}).Count(&n).Error; err != nil {
				t.Fatal(err)
			}
			if n != 1 {
				t.Errorf("%d libraries left, want 1", n)
			}
		})
	}
}

// An empty catalog deletes nothing: "external_id NOT IN (NULL)" matches no
// rows.
func TestImportLibrariesEmptyCatalog(t *testing.T) {
	db := newTestDB(t)
	newFakeCore(t)
	kiwix := newFakeKiwix(t, `<feed xmlns="http://www.w3.org/2005/Atom"></feed>`)
	if err := db.Create(library(1, "urn:uuid:a", "Wikipedia")).Error; err != nil {
		t.Fatal(err)
	}

	ks := NewKiwixService(kiwixProvider(1, kiwix.URL), map[string]any{"job_id": "job-1"})
	if err := ks.ImportLibraries(context.Background(), db); err != nil {
		t.Fatalf("ImportLibraries: %v", err)
	}
	var n int64
	if err := db.Model(&Library{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("%d libraries left, want 1", n)
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func equalMaps(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}
