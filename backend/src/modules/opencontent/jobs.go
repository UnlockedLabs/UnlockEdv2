package opencontent

import (
	"context"
	"encoding/json"
	"os"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

// The jobs Open Content publishes for its worker (worker.go): the scheduled
// ones below, and the video jobs its routes publish.

// everyDaytimeHour is when failed downloads are retried, unless
// RETRY_VIDEO_CRON_SCHEDULE says otherwise.
const everyDaytimeHour = "0 6-20 * * *"

// scheduledJob is a job the scheduler publishes on a cron schedule.
type scheduledJob struct {
	job      jobs.Type
	schedule string
}

func scheduledJobs() []scheduledJob {
	retrySchedule := os.Getenv("RETRY_VIDEO_CRON_SCHEDULE")
	if retrySchedule == "" {
		retrySchedule = everyDaytimeHour
	}
	return []scheduledJob{
		{jobs.ScrapeKiwix, os.Getenv("MIDDLEWARE_CRON_SCHEDULE")},
		{jobs.RetryVideoDownloads, retrySchedule},
		{jobs.SyncVideoMetadata, os.Getenv("MIDDLEWARE_CRON_SCHEDULE")},
	}
}

// scheduleJobs puts each scheduled job on its cron schedule and, outside dev,
// also runs it once at start. In dev only the scrape runs at start.
func scheduleJobs(s module.Scheduler, p *jobPublisher, dev bool) {
	for _, sj := range scheduledJobs() {
		run := func() { p.run(context.Background(), sj.job) }
		// A bad schedule doesn't stop the run at start, as before EN-196.
		if err := s.Cron(sj.schedule, run); err != nil {
			log.Errorf("Failed to schedule %s: %v", sj.job, err)
		}
		if dev && sj.job != jobs.ScrapeKiwix {
			continue
		}
		if err := s.AtStart(run); err != nil {
			log.Errorf("Failed to schedule %s at start: %v", sj.job, err)
		}
	}
}

// jobPublisher publishes a scheduled job for the provider that runs it.
type jobPublisher struct {
	store   *store
	publish func(*nats.Msg) error
}

// run publishes job for the first enabled provider of its kind: Kiwix for the
// library jobs, YouTube for the video jobs. With none enabled it publishes
// nothing.
func (p *jobPublisher) run(ctx context.Context, job jobs.Type) {
	title := Youtube
	if job.IsLibraryJob() {
		title = Kiwix
	}
	providerID, err := p.store.GetEnabledProviderID(ctx, title)
	if err != nil {
		log.Errorf("failed to find the provider for %s: %v", job, err)
		return
	}
	if providerID == 0 {
		return
	}
	msg, err := scheduledJobMsg(job, providerID)
	if err != nil {
		log.Errorf("failed to marshal params: %v", err)
		return
	}
	if err := p.publish(msg); err != nil {
		log.Errorf("failed to publish job: %v", err)
		return
	}
	log.Info("Published job: ", job)
}

// scheduledJobMsg asks the worker to run a scheduled job for a provider.
func scheduledJobMsg(job jobs.Type, providerID uint) (*nats.Msg, error) {
	msg := nats.NewMsg(job.PubName())
	body := make(map[string]any)
	body["open_content_provider_id"] = providerID
	body["job_type"] = job
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	msg.Data = bodyBytes
	return msg, nil
}

// addVideosMsg asks the worker to download new videos.
func addVideosMsg(videoUrls []string, provider *OpenContentProvider) (*nats.Msg, error) {
	msg := nats.NewMsg(jobs.AddVideos.PubName())
	body := make(map[string]any)
	body["open_content_provider_id"] = provider.ID
	body["job_type"] = jobs.AddVideos
	body["video_urls"] = videoUrls
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	msg.Data = bodyBytes
	return msg, nil
}

// retryManualDownloadMsg asks the worker to try a failed video download
// again. Its job_type is retry_video_downloads, as it was in core.
func retryManualDownloadMsg(video *Video) (*nats.Msg, error) {
	msg := nats.NewMsg(jobs.RetryManualDownload.PubName())
	body := make(map[string]any)
	body["video_id"] = video.ID
	body["open_content_provider_id"] = video.OpenContentProviderID
	body["job_type"] = jobs.RetryVideoDownloads
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	msg.Data = bodyBytes
	return msg, nil
}
