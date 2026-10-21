package opencontent

import (
	"encoding/json"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"
	"github.com/nats-io/nats.go"
)

// The video jobs the routes publish for provider-middleware to run. Open
// Content's scheduled jobs still run from core's scheduler until EN-196.

// addVideosMsg asks provider-middleware to download new videos.
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

// retryManualDownloadMsg asks provider-middleware to try a failed video
// download again. Its job_type is retry_video_downloads, as it was in core.
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
