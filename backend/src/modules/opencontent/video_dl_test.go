package opencontent

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

// fakeYtDlp is a stand-in yt-dlp. It logs each call's arguments, prints
// FAKE_YTDLP_INFO for an info request, and otherwise exits with
// FAKE_YTDLP_EXIT. It uses only shell builtins, since PATH holds nothing else.
const fakeYtDlp = `#!/bin/sh
echo "$@" >> "$FAKE_YTDLP_LOG"
case " $* " in
  *" --dump-single-json "*) printf '%s\n' "$FAKE_YTDLP_INFO"; exit 0 ;;
esac
exit "${FAKE_YTDLP_EXIT:-0}"
`

// ytDlp is the fake yt-dlp installed for one test.
type ytDlp struct {
	t   *testing.T
	log string
}

// installYtDlp puts the fake yt-dlp alone on PATH. Its info request returns a
// video with ID "vid123" whose thumbnail is thumbnailURL.
func installYtDlp(t *testing.T, thumbnailURL string) *ytDlp {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "yt-dlp"), []byte(fakeYtDlp), 0o755); err != nil {
		t.Fatal(err)
	}
	info, err := json.Marshal(map[string]any{
		"id":          "vid123",
		"title":       "A video",
		"description": "Watch https://example.com now",
		"channel":     "A channel",
		"duration":    125.7,
		"thumbnail":   thumbnailURL,
	})
	if err != nil {
		t.Fatal(err)
	}
	y := &ytDlp{t: t, log: filepath.Join(dir, "calls.log")}
	t.Setenv("PATH", dir)
	t.Setenv("FAKE_YTDLP_LOG", y.log)
	t.Setenv("FAKE_YTDLP_INFO", string(info))
	t.Setenv("FAKE_YTDLP_EXIT", "0")
	return y
}

// failDownloads makes every download fail; info requests still work.
func (y *ytDlp) failDownloads() { y.t.Setenv("FAKE_YTDLP_EXIT", "1") }

// calls returns the arguments of each call, in order.
func (y *ytDlp) calls() []string {
	data, err := os.ReadFile(y.log)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		y.t.Fatal(err)
	}
	return strings.Split(strings.TrimSpace(string(data)), "\n")
}

const infoCall = "--ignore-errors --no-call-home --restrict-filenames --netrc --batch-file - --dump-single-json"

func downloadCall(url string) string {
	return "-f bv*+ba/b -S res:480,ext:mp4 --merge-output-format mp4 --remux-video mp4 --restrict-filenames --no-call-home --netrc --output /videos/%(id)s.mp4 --print after_move:filepath " + url
}

// newFakeThumbnails serves a 300-byte image at /thumb.jpg and 404 elsewhere.
func newFakeThumbnails(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/thumb.jpg" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(image(300))
	}))
	t.Cleanup(srv.Close)
	return srv
}

const youtubeProviderID = 2

func newVideoService(t *testing.T, db *gorm.DB, body map[string]any) *VideoService {
	t.Helper()
	t.Setenv("S3_BUCKET_NAME", "")
	p := &OpenContentProvider{Url: "https://www.youtube.com"}
	p.ID = youtubeProviderID
	return NewVideoService(p, &store{db: db}, body)
}

func createVideo(t *testing.T, db *gorm.DB, v *Video) *Video {
	t.Helper()
	if v.OpenContentProviderID == 0 {
		v.OpenContentProviderID = youtubeProviderID
	}
	if err := db.Create(v).Error; err != nil {
		t.Fatal(err)
	}
	return v
}

func attempts(t *testing.T, db *gorm.DB, videoID uint) []VideoDownloadAttempt {
	t.Helper()
	var got []VideoDownloadAttempt
	if err := db.Where("video_id = ?", videoID).Order("id").Find(&got).Error; err != nil {
		t.Fatal(err)
	}
	return got
}

func TestAddVideos(t *testing.T) {
	const url = "https://www.youtube.com/watch?v=vid123"
	tests := []struct {
		name          string
		thumbnailPath string
		failDownload  bool
		wantAvail     VideoAvailability
		wantThumbnail string
		wantUploads   []string
		wantAttempts  int
		wantDownload  bool
	}{
		{
			name:          "downloaded",
			thumbnailPath: "/thumb.jpg",
			wantAvail:     VideoAvailable,
			wantThumbnail: "/api/photos/vid123.jpg",
			wantUploads:   []string{"vid123.jpg"},
			wantDownload:  true,
		},
		{
			// fetchAndSaveInitialVideoInfo returns the thumbnail error after
			// falling back to /youtube.png, so the video is saved but not
			// downloaded. The retry job picks it up after 30 minutes.
			name:          "thumbnail missing",
			thumbnailPath: "/missing.jpg",
			wantAvail:     VideoProcessing,
			wantThumbnail: "/youtube.png",
		},
		{
			name:          "download fails",
			thumbnailPath: "/thumb.jpg",
			failDownload:  true,
			wantAvail:     VideoHasError,
			wantThumbnail: "/api/photos/vid123.jpg",
			wantUploads:   []string{"vid123.jpg"},
			wantAttempts:  1,
			wantDownload:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			core := newFakeCore(t)
			thumbs := newFakeThumbnails(t)
			yt := installYtDlp(t, thumbs.URL+tt.thumbnailPath)
			if tt.failDownload {
				yt.failDownloads()
			}

			vs := newVideoService(t, db, map[string]any{"video_urls": []any{url}})
			if err := vs.addVideos(context.Background()); err != nil {
				t.Fatalf("addVideos: %v", err)
			}

			var v Video
			if err := db.First(&v).Error; err != nil {
				t.Fatal(err)
			}
			if v.ExternalID != "vid123" || v.Url != url || v.Title != "A video" ||
				deref(v.Description) != "Watch [URL Removed] now " || deref(v.ChannelTitle) != "A channel" ||
				v.Duration != 125 || v.OpenContentProviderID != youtubeProviderID {
				t.Errorf("video = %+v", v)
			}
			if v.Availability != tt.wantAvail {
				t.Errorf("availability = %q, want %q", v.Availability, tt.wantAvail)
			}
			if got := deref(v.ThumbnailUrl); got != tt.wantThumbnail {
				t.Errorf("thumbnail = %q, want %q", got, tt.wantThumbnail)
			}
			var uploaded []string
			for _, u := range core.Uploads() {
				uploaded = append(uploaded, u.Filename)
				if u.Fields["type"] != "image/jpg" || u.Fields["size"] != "300" {
					t.Errorf("upload fields = %v", u.Fields)
				}
			}
			if !slices.Equal(uploaded, tt.wantUploads) {
				t.Errorf("uploads = %v, want %v", uploaded, tt.wantUploads)
			}
			if got := len(attempts(t, db, v.ID)); got != tt.wantAttempts {
				t.Errorf("%d download attempts, want %d", got, tt.wantAttempts)
			}
			want := []string{infoCall}
			if tt.wantDownload {
				want = append(want, downloadCall(url))
			}
			if got := yt.calls(); !slices.Equal(got, want) {
				t.Errorf("yt-dlp calls:\n got %q\nwant %q", got, want)
			}
		})
	}
}

// A video that's already saved is skipped without calling yt-dlp: a YouTube
// URL matches on its video ID, any other URL on the whole URL.
func TestAddVideosSkipsExisting(t *testing.T) {
	db := newTestDB(t)
	newFakeCore(t)
	yt := installYtDlp(t, "")
	createVideo(t, db, &Video{ExternalID: "abc", Url: "https://youtu.be/abc", Availability: VideoAvailable})
	createVideo(t, db, &Video{ExternalID: "x1", Url: "https://vimeo.com/1", Availability: VideoAvailable})

	urls := []any{"https://www.youtube.com/watch?v=abc&t=3", "https://vimeo.com/1"}
	vs := newVideoService(t, db, map[string]any{"video_urls": urls})
	if err := vs.addVideos(context.Background()); err != nil {
		t.Fatalf("addVideos: %v", err)
	}
	if calls := yt.calls(); len(calls) != 0 {
		t.Errorf("yt-dlp was called: %q", calls)
	}
	var n int64
	if err := db.Model(&Video{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("%d videos, want 2", n)
	}
}

func TestAddVideosNoURLs(t *testing.T) {
	db := newTestDB(t)
	yt := installYtDlp(t, "")
	vs := newVideoService(t, db, map[string]any{})
	if err := vs.addVideos(context.Background()); err != nil {
		t.Fatalf("addVideos: %v", err)
	}
	if calls := yt.calls(); len(calls) != 0 {
		t.Errorf("yt-dlp was called: %q", calls)
	}
}

func TestRetryFailedVideos(t *testing.T) {
	db := newTestDB(t)
	newFakeCore(t)
	yt := installYtDlp(t, "")
	hourAgo := time.Now().Add(-time.Hour)

	failed := createVideo(t, db, &Video{ExternalID: "f", Url: "https://youtu.be/f", Availability: VideoHasError})
	staleProcessing := createVideo(t, db, &Video{ExternalID: "s", Url: "https://youtu.be/s", Availability: VideoProcessing})
	newProcessing := createVideo(t, db, &Video{ExternalID: "n", Url: "https://youtu.be/n", Availability: VideoProcessing})
	recentlyTried := createVideo(t, db, &Video{ExternalID: "r", Url: "https://youtu.be/r", Availability: VideoProcessing})
	available := createVideo(t, db, &Video{ExternalID: "a", Url: "https://youtu.be/a", Availability: VideoAvailable})
	for _, v := range []*Video{failed, staleProcessing, recentlyTried, available} {
		if err := db.Model(v).UpdateColumn("created_at", hourAgo).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Create(&VideoDownloadAttempt{VideoID: recentlyTried.ID}).Error; err != nil {
		t.Fatal(err)
	}

	vs := newVideoService(t, db, map[string]any{"job_id": "job-1"})
	if err := vs.retryFailedVideos(context.Background()); err != nil {
		t.Fatalf("retryFailedVideos: %v", err)
	}

	want := map[uint]VideoAvailability{
		failed.ID:          VideoAvailable,
		staleProcessing.ID: VideoAvailable,
		// Too new to retry, or tried in the last 10 minutes.
		newProcessing.ID: VideoProcessing,
		recentlyTried.ID: VideoProcessing,
		available.ID:     VideoAvailable,
	}
	for id, avail := range want {
		var v Video
		if err := db.First(&v, id).Error; err != nil {
			t.Fatal(err)
		}
		if v.Availability != avail {
			t.Errorf("video %s availability = %q, want %q", v.ExternalID, v.Availability, avail)
		}
	}
	// Each retried video is looked up and downloaded once.
	if got := len(yt.calls()); got != 4 {
		t.Errorf("%d yt-dlp calls, want 4: %q", got, yt.calls())
	}
}

// A failed retry records one attempt. At the attempt limit the video is
// deleted instead.
func TestRetryFailedDownload(t *testing.T) {
	tests := []struct {
		name         string
		priorTries   int
		wantAttempts int
		wantDeleted  bool
	}{
		{name: "first failure", priorTries: 0, wantAttempts: 1},
		{name: "last try left", priorTries: MAX_DOWNLOAD_ATTEMPTS - 1, wantAttempts: MAX_DOWNLOAD_ATTEMPTS},
		{name: "out of tries", priorTries: MAX_DOWNLOAD_ATTEMPTS, wantAttempts: MAX_DOWNLOAD_ATTEMPTS, wantDeleted: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			newFakeCore(t)
			installYtDlp(t, "").failDownloads()
			v := createVideo(t, db, &Video{ExternalID: "f", Url: "https://youtu.be/f", Availability: VideoHasError})
			for range tt.priorTries {
				attempt := VideoDownloadAttempt{VideoID: v.ID}
				attempt.CreatedAt = time.Now().Add(-time.Hour)
				if err := db.Create(&attempt).Error; err != nil {
					t.Fatal(err)
				}
			}

			vs := newVideoService(t, db, map[string]any{})
			if err := vs.retrySingleVideo(context.Background(), int(v.ID)); err != nil {
				t.Fatalf("retrySingleVideo: %v", err)
			}

			got := attempts(t, db, v.ID)
			if len(got) != tt.wantAttempts {
				t.Errorf("%d attempts, want %d", len(got), tt.wantAttempts)
			}
			if !tt.wantDeleted && deref(got[len(got)-1].ErrorMessage) != "exit status 1" {
				t.Errorf("last attempt's error = %q, want %q", deref(got[len(got)-1].ErrorMessage), "exit status 1")
			}
			var after Video
			if err := db.Unscoped().First(&after, v.ID).Error; err != nil {
				t.Fatal(err)
			}
			if after.DeletedAt.Valid != tt.wantDeleted {
				t.Errorf("deleted = %v, want %v", after.DeletedAt.Valid, tt.wantDeleted)
			}
			if !tt.wantDeleted && after.Availability != VideoHasError {
				t.Errorf("availability = %q, want %q", after.Availability, VideoHasError)
			}
		})
	}
}

// A video that's already available isn't downloaded again.
func TestRetrySingleVideoAvailable(t *testing.T) {
	db := newTestDB(t)
	yt := installYtDlp(t, "")
	v := createVideo(t, db, &Video{ExternalID: "a", Url: "https://youtu.be/a", Availability: VideoAvailable})

	vs := newVideoService(t, db, map[string]any{})
	if err := vs.retrySingleVideo(context.Background(), int(v.ID)); err != nil {
		t.Fatalf("retrySingleVideo: %v", err)
	}
	if calls := yt.calls(); len(calls) != 0 {
		t.Errorf("yt-dlp was called: %q", calls)
	}
	if n := len(attempts(t, db, v.ID)); n != 0 {
		t.Errorf("%d attempts, want 0", n)
	}
}

func TestSyncVideoMetadata(t *testing.T) {
	tests := []struct {
		name string
		// files and rows are the external IDs on disk and in the database.
		files, rows []string
		// wantRows and wantFiles are the external IDs after the sync.
		wantRows, wantFiles []string
	}{
		{name: "file not in database", files: []string{"a", "b"}, rows: []string{"b"}, wantRows: []string{"a", "b"}, wantFiles: []string{"a", "b"}},
		{name: "row not on disk", files: []string{"a"}, rows: []string{"a", "c"}, wantRows: []string{"a", "c"}, wantFiles: []string{"a", "c"}},
		{name: "both", files: []string{"a", "b"}, rows: []string{"b", "c", "d"}, wantRows: []string{"a", "b", "c", "d"}, wantFiles: []string{"a", "b", "c", "d"}},
		// The sync stops early when the counts match, even if the IDs differ.
		{name: "same count, different videos", files: []string{"a"}, rows: []string{"c"}, wantRows: []string{"c"}, wantFiles: []string{"a"}},
		{name: "no files", rows: []string{"c"}, wantRows: []string{"c"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			dir := t.TempDir() + "/"
			old := videosDir
			videosDir = dir
			t.Cleanup(func() { videosDir = old })

			for _, id := range tt.files {
				data, err := json.Marshal(Video{ExternalID: id, Url: "https://youtu.be/" + id, Title: "On disk " + id, OpenContentProviderID: youtubeProviderID, Availability: VideoAvailable})
				if err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, id+".json"), data, 0o644); err != nil {
					t.Fatal(err)
				}
			}
			for _, id := range tt.rows {
				createVideo(t, db, &Video{ExternalID: id, Url: "https://youtu.be/" + id, Title: "In db " + id, Availability: VideoAvailable})
			}
			if err := os.WriteFile(filepath.Join(dir, "a.mp4"), nil, 0o644); err != nil {
				t.Fatal(err)
			}

			vs := newVideoService(t, db, map[string]any{"job_id": "job-1"})
			if err := vs.syncVideoMetadata(context.Background()); err != nil {
				t.Fatalf("syncVideoMetadata: %v", err)
			}

			var rows []string
			if err := db.Model(&Video{}).Order("external_id").Pluck("external_id", &rows).Error; err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(rows, tt.wantRows) {
				t.Errorf("rows = %v, want %v", rows, tt.wantRows)
			}
			var files []string
			matches, err := filepath.Glob(filepath.Join(dir, "*.json"))
			if err != nil {
				t.Fatal(err)
			}
			for _, m := range matches {
				files = append(files, strings.TrimSuffix(filepath.Base(m), ".json"))
			}
			if !slices.Equal(files, tt.wantFiles) {
				t.Errorf("files = %v, want %v", files, tt.wantFiles)
			}
			// A row written to disk round-trips.
			for _, id := range tt.wantFiles {
				if slices.Contains(tt.files, id) {
					continue
				}
				data, err := os.ReadFile(filepath.Join(dir, id+".json"))
				if err != nil {
					t.Fatal(err)
				}
				var v Video
				if err := json.Unmarshal(data, &v); err != nil {
					t.Fatal(err)
				}
				if v.Title != "In db "+id {
					t.Errorf("%s.json title = %q, want %q", id, v.Title, "In db "+id)
				}
			}
		})
	}
}

func TestValidateVideoURL(t *testing.T) {
	tests := []struct {
		url   string
		valid bool
	}{
		{"https://www.youtube.com/watch?v=abc", true},
		{"http://example.com/video.mp4", true},
		{"ftp://example.com/video.mp4", false},
		{"https://", false},
		{"https://example.com/a;rm -rf", false},
		{"https://example.com/a|b", false},
		{"https://example.com/a$b", false},
		{"https://example.com/a`b`", false},
		{"https://example.com/a&b", false},
		{"https://example.com/a%0Ab", false},
		{"https://example.com/a%0db", false},
		{"https://example.com/a\nb", false},
		{"://bad", false},
	}
	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			err := validateVideoURL(tt.url)
			if (err == nil) != tt.valid {
				t.Errorf("validateVideoURL(%q) = %v, want valid=%v", tt.url, err, tt.valid)
			}
			if err != nil && !errors.Is(err, errInvalidVideoURL) {
				t.Errorf("error %v isn't errInvalidVideoURL", err)
			}
		})
	}
}

func TestYtIdFromUrl(t *testing.T) {
	tests := []struct {
		url, want string
	}{
		{"https://www.youtube.com/watch?v=abc", "abc"},
		{"https://www.youtube.com/watch?v=abc&t=30", "abc"},
		{"https://youtu.be/abc", "abc"},
		{"https://youtu.be/abc?t=30", "abc"},
		{"https://vimeo.com/123", ""},
	}
	for _, tt := range tests {
		if got := ytIdFromUrl(tt.url); got != tt.want {
			t.Errorf("ytIdFromUrl(%q) = %q, want %q", tt.url, got, tt.want)
		}
	}
}

func TestStripUrlsFromDescription(t *testing.T) {
	tests := []struct {
		desc, want string
	}{
		{"no links here", "no links here "},
		{"see https://example.com and http://x.y", "see [URL Removed] and [URL Removed] "},
		{"", " "},
	}
	for _, tt := range tests {
		if got := stripUrlsFromDescription(tt.desc); got != tt.want {
			t.Errorf("stripUrlsFromDescription(%q) = %q, want %q", tt.desc, got, tt.want)
		}
	}
}
