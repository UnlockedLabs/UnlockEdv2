package opencontent

import (
	"context"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"

	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWorkerSubscriptions(t *testing.T) {
	w := &worker{}
	got := map[string]time.Duration{}
	for _, j := range w.subscriptions() {
		got[j.job.PubName()] = j.timeout
	}
	assert.Equal(t, map[string]time.Duration{
		"tasks.scrape_kiwix":          30 * time.Minute,
		"tasks.add_videos":            30 * time.Minute,
		"tasks.retry_video_downloads": 4 * time.Hour,
		"tasks.retry_manual_download": 30 * time.Minute,
		"tasks.sync_video_metadata":   30 * time.Minute,
	}, got)
}

// The worker runs the scrape from the message the scheduler publishes.
func TestWorkerScrapeLibraries(t *testing.T) {
	db := newTestDB(t)
	newFakeCore(t)
	kiwix := newFakeKiwix(t, kiwixFeed)
	provider := createProvider(t, db, Kiwix, true)
	require.NoError(t, db.Model(provider).Update("url", kiwix.URL).Error)

	msg, err := scheduledJobMsg(jobs.ScrapeKiwix, provider.ID)
	require.NoError(t, err)
	w := &worker{db: db}
	w.scrapeLibraries(context.Background(), msg)

	var titles []string
	require.NoError(t, db.Model(&Library{}).Order("title").Pluck("title", &titles).Error)
	assert.Equal(t, []string{"Gutenberg", "Tiny", "Wikipedia"}, titles)
}

// The worker downloads videos from the messages the video routes publish.
func TestWorkerVideoRoutes(t *testing.T) {
	const url = "https://www.youtube.com/watch?v=vid123"
	db := newTestDB(t)
	newFakeCore(t)
	thumbs := newFakeThumbnails(t)
	yt := installYtDlp(t, thumbs.URL+"/thumb.jpg")
	t.Setenv("S3_BUCKET_NAME", "")
	provider := createProvider(t, db, Youtube, true)
	w := &worker{db: db}

	add, err := addVideosMsg([]string{url}, provider)
	require.NoError(t, err)
	yt.failDownloads()
	w.addVideos(context.Background(), add)

	var v Video
	require.NoError(t, db.First(&v, "external_id = ?", "vid123").Error)
	assert.Equal(t, VideoHasError, v.Availability)

	retry, err := retryManualDownloadMsg(&v)
	require.NoError(t, err)
	t.Setenv("FAKE_YTDLP_EXIT", "0")
	w.retryManualDownload(context.Background(), retry)

	require.NoError(t, db.First(&v, v.ID).Error)
	assert.Equal(t, VideoAvailable, v.Availability)
	assert.Equal(t, []string{infoCall, downloadCall(url), infoCall, downloadCall(url)}, yt.calls())
}

// A message the worker can't read is logged and dropped.
func TestWorkerBadMessages(t *testing.T) {
	tests := []struct {
		name string
		run  func(w *worker, ctx context.Context, msg *nats.Msg)
		data string
	}{
		{name: "not json", run: (*worker).addVideos, data: "{"},
		{name: "no provider", run: (*worker).addVideos, data: `{"video_urls":["https://youtu.be/a"]}`},
		{name: "no video id", run: (*worker).retryManualDownload, data: `{"open_content_provider_id":1}`},
		{name: "scrape without provider", run: (*worker).scrapeLibraries, data: `{}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newTestDB(t)
			yt := installYtDlp(t, "")
			tt.run(&worker{db: db}, context.Background(), &nats.Msg{Data: []byte(tt.data)})
			assert.Empty(t, yt.calls())
			var n int64
			require.NoError(t, db.Model(&Video{}).Count(&n).Error)
			assert.Zero(t, n)
		})
	}
}
