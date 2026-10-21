package opencontent

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// The worker (`backend worker opencontent`) runs Open Content's jobs: the
// scheduled ones RegisterJobs publishes and the video jobs the routes publish.
// It took them over from provider-middleware in EN-196.

const (
	// queueGroup makes each job run on one worker, however many are running.
	queueGroup = "opencontent"
	jobTimeout = 30 * time.Minute
	// retryVideosTimeout is longer because it retries every failed download.
	retryVideosTimeout = 4 * time.Hour
)

type worker struct {
	db *gorm.DB
}

// run subscribes to every job and runs each one as it arrives, until ctx is
// canceled. Canceling ctx also stops the jobs that are running.
func (w *worker) run(ctx context.Context, nc *nats.Conn) error {
	for _, j := range w.subscriptions() {
		_, err := nc.QueueSubscribe(j.job.PubName(), queueGroup, func(msg *nats.Msg) {
			ctx, cancel := context.WithTimeout(ctx, j.timeout)
			defer cancel()
			j.run(ctx, msg)
		})
		if err != nil {
			return fmt.Errorf("subscribe to %s: %w", j.job.PubName(), err)
		}
	}
	<-ctx.Done()
	return nil
}

// workerJob is one job the worker runs, and how long it may take.
type workerJob struct {
	job     jobs.Type
	timeout time.Duration
	run     func(ctx context.Context, msg *nats.Msg)
}

func (w *worker) subscriptions() []workerJob {
	return []workerJob{
		{jobs.ScrapeKiwix, jobTimeout, w.scrapeLibraries},
		{jobs.AddVideos, jobTimeout, w.addVideos},
		{jobs.RetryVideoDownloads, retryVideosTimeout, w.retryFailedVideos},
		{jobs.RetryManualDownload, jobTimeout, w.retryManualDownload},
		{jobs.SyncVideoMetadata, jobTimeout, w.syncVideoMetadata},
	}
}

func (w *worker) scrapeLibraries(ctx context.Context, msg *nats.Msg) {
	provider, body, err := w.provider(ctx, msg)
	if err != nil {
		log.Errorf("error fetching provider service from msg parameters %v", err)
		return
	}
	if err := NewKiwixService(provider, body).ImportLibraries(ctx, w.db); err != nil {
		log.Errorf("error scraping kiwix libraries: %v", err)
	}
}

func (w *worker) addVideos(ctx context.Context, msg *nats.Msg) {
	provider, body, err := w.provider(ctx, msg)
	if err != nil {
		log.Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	if err := NewVideoService(provider, w.db, body).addVideos(ctx); err != nil {
		log.Errorf("error adding videos: %v", err)
	}
}

func (w *worker) retryManualDownload(ctx context.Context, msg *nats.Msg) {
	log.Infof("Retrying failed video")
	provider, body, err := w.provider(ctx, msg)
	if err != nil {
		log.Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	videoID, ok := body["video_id"].(float64)
	if !ok {
		log.Errorf("video_id not found in body")
		return
	}
	if err := NewVideoService(provider, w.db, body).retrySingleVideo(ctx, int(videoID)); err != nil {
		log.Errorf("error retrying single video: %v", err)
	}
}

func (w *worker) retryFailedVideos(ctx context.Context, msg *nats.Msg) {
	log.Infof("Retrying failed videos")
	provider, body, err := w.provider(ctx, msg)
	if err != nil {
		log.Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	if err := NewVideoService(provider, w.db, body).retryFailedVideos(ctx); err != nil {
		log.Errorf("error retrying failed videos: %v", err)
	}
}

func (w *worker) syncVideoMetadata(ctx context.Context, msg *nats.Msg) {
	log.Infof("Syncing video metadata")
	provider, body, err := w.provider(ctx, msg)
	if err != nil {
		log.Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	if err := NewVideoService(provider, w.db, body).syncVideoMetadata(ctx); err != nil {
		log.Errorf("error syncing video metadata: %v", err)
	}
}

// provider decodes a job message and looks up the content provider it names.
// A provider ID with no row gives an empty provider, not an error.
func (w *worker) provider(ctx context.Context, msg *nats.Msg) (*OpenContentProvider, map[string]any, error) {
	var body map[string]any
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal message: %w", err)
	}
	providerID, ok := body["open_content_provider_id"].(float64)
	if !ok {
		return nil, body, fmt.Errorf("failed to parse open_content_provider_id: %v", body)
	}
	var provider OpenContentProvider
	if err := w.db.WithContext(ctx).Find(&provider, int(providerID)).Error; err != nil {
		return nil, body, fmt.Errorf("failed to find open content provider: %w", err)
	}
	return &provider, body, nil
}
