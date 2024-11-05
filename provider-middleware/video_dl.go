package main

import (
	"UnlockEdv2/src/models"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/wader/goutubedl"
	"gorm.io/gorm"
)

type YoutubeDataResponse struct {
	Items []struct {
		ID      string `json:"id"`
		Snippet struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Thumbnails  struct {
				Default Thumbnail `json:"default"`
				High    Thumbnail `json:"high"`
				Medium  Thumbnail `json:"medium"`
				Low     Thumbnail `json:"low"`
			} `json:"thumbnails"`
			ChannelTitle string `json:"channelTitle"`
		} `json:"snippet"`
	} `json:"items"`
}

type Thumbnail struct {
	Url    string  `json:"url"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

var MAX_DOWNLOAD_ATTEMPTS = sync.OnceValue(func() int {
	maxAttempts := os.Getenv("MAX_DOWNLOAD_ATTEMPTS")
	if maxAttempts == "" {
		maxAttempts = "5"
	}
	val, err := strconv.Atoi(maxAttempts)
	if err != nil {
		val = 5
	}
	return val
})

type VideoService struct {
	BaseUrl               string
	YtApiKey              string
	OpenContentProviderID uint
	Client                *http.Client
	Body                  *map[string]interface{}
	db                    *gorm.DB
}

func NewVideoService(prov *models.OpenContentProvider, db *gorm.DB, body *map[string]interface{}) *VideoService {
	apiKey := os.Getenv("YOUTUBE_API_KEY")
	if prov.ApiKey != nil {
		apiKey = *prov.ApiKey
	}
	return &VideoService{
		BaseUrl:               prov.BaseUrl,
		YtApiKey:              apiKey,
		Client:                &http.Client{},
		Body:                  body,
		OpenContentProviderID: prov.ID,
		db:                    db,
	}
}

func (yt *VideoService) downloadAndHostThumbnail(yt_id, url string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		logger().Errorf("error creating request: %v", err)
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "image/*")

	resp, err := yt.Client.Do(req)
	if err != nil {
		logger().Errorf("error fetching thumbnail image from URL: %v", err)
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logger().Errorf("failed to fetch thumbnail image: received %v response", resp.Status)
		return "", fmt.Errorf("failed to fetch thumbnail image: %v", resp.Status)
	}

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		logger().Errorf("error reading thumbnail image: %v", err)
		return "", err
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	filename := yt_id + ".jpg"

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	_, err = part.Write(imgData)
	if err != nil {
		return "", err
	}
	fields := map[string]string{"filename": filename, "size": fmt.Sprintf("%d", len(imgData)), "type": "image/jpg"}
	for key, value := range fields {
		err = writer.WriteField(key, value)
		if err != nil {
			return "", err
		}
	}
	err = writer.Close()
	if err != nil {
		logger().Errorf("error closing writer: %v", err)
		return "", err
	}

	uploadURL := os.Getenv("APP_URL") + "/upload"
	req, err = http.NewRequest(http.MethodPost, uploadURL, body)
	if err != nil {
		logger().Errorf("error creating upload request: %v", err)
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := yt.Client.Do(req)
	if err != nil {
		logger().Errorf("error sending upload request: %v", err)
		return "", err
	}
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		logger().Errorf("failed to upload image: received %v response", uploadResp.Status)
		return "", fmt.Errorf("failed to upload image: %v", uploadResp.Status)
	}

	type UploadResponse struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
		Message string `json:"message"`
	}

	urlRes := &UploadResponse{}
	err = json.NewDecoder(uploadResp.Body).Decode(urlRes)
	if err != nil {
		logger().Errorf("error decoding upload response: %v", err)
		return "", err
	}
	return urlRes.Data.URL, nil
}

const YtQueryParams = "&part=snippet,statistics&fields=items(id,snippet,statistics)"

func stripUrlsFromDescription(desc string) string {
	splitWords := strings.Split(desc, " ")
	builder := strings.Builder{}
	for _, word := range splitWords {
		if strings.Contains(word, "http") {
			builder.WriteString("[URL Removed] ")
			continue
		}
		builder.WriteString(word)
		builder.WriteString(" ")
	}
	return builder.String()
}

func (vs *VideoService) RetryFailedVideos(ctx context.Context) error {
	videos := make([]models.Video, 0)
	if err := vs.db.WithContext(ctx).Model(&models.Video{}).Find(&videos, "availability <> 'available'").Error; err != nil {
		logger().Errorf("error fetching failed videos: %v", err)
	}
	for _, video := range videos {
		if err := vs.RetrySingleVideo(ctx, int(video.ID)); err != nil {
			logger().Errorf("error retrying single video: %v", err)
			err = vs.incrementFailedAttempt(ctx, &video, err.Error())
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (vs *VideoService) RetrySingleVideo(ctx context.Context, videoId int) error {
	var video models.Video
	if err := vs.db.WithContext(ctx).First(&video, videoId).Error; err != nil {
		logger().Errorf("error fetching video: %v", err)
		return vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	if video.Url == nil {
		if video.YoutubeID == nil {
			logger().Errorf("video has no url or youtube id, cannot proceed with download")
			if err := vs.incrementFailedAttempt(ctx, &video, "video has no url or youtube id"); err != nil {
				logger().Errorf("error incrementing failed attempt: %v", err)
			}
		} else {
			video.Url = models.StringPtr(fmt.Sprintf("https://www.youtube.com/watch?v=%s", *video.YoutubeID))
		}
	}
	err := vs.downloadVideo(ctx, *video.Url, &video)
	if err != nil {
		logger().Errorf("error downloading video: %v", err)
		vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	return nil
}

func (yt *VideoService) AddVideos(ctx context.Context) error {
	params := *yt.Body
	urls := params["video_urls"].([]interface{})
	logger().Infof("Adding videos: %v", urls)
	for idx := range urls {
		select {
		case <-ctx.Done():
			return nil
		default:
			urlStr := urls[idx].(string)
			if strings.Contains(urlStr, "youtube.com") {
				err := yt.fetchYoutubeInfo(ctx, urlStr)
				if err != nil {
					logger().Errorf("Error fetching youtube info: %v", err)
				}
			} else {
				err := yt.downloadVideo(ctx, urlStr, nil)
				if err != nil {
					logger().Errorf("Error downloading video: %v", err)
				}
			}
		}
	}
	return nil
}

func (vs *VideoService) fetchYoutubeInfo(ctx context.Context, ytUrl string) error {
	parsed, err := url.Parse(ytUrl)
	if err != nil {
		logger().Errorf("Error parsing url: %v", err)
		return err
	}
	id := parsed.Query().Get("v")
	finalUrl := fmt.Sprintf("%s?id=%s&key=%s%s", vs.BaseUrl, id, vs.YtApiKey, YtQueryParams)
	logger().Infof("url to fetch video: %s", finalUrl)
	resp, err := http.Get(finalUrl)
	if err != nil {
		logger().Errorf("Error getting video: %v", err)
		return err
	}
	defer resp.Body.Close()
	var data YoutubeDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		logger().Errorf("Error decoding video info: %v", err)
		return err
	}
	if len(data.Items) == 0 {
		logger().Errorf("Video not found in response from youtube API")
		return fmt.Errorf("Video not found")
	}
	logger().Infof("Adding videos: %v", data)
	thumbnailUrl, err := vs.downloadAndHostThumbnail(data.Items[0].ID, data.Items[0].Snippet.Thumbnails.High.Url)
	if err != nil {
		logger().Errorf("Error downloading and hosting thumbnail: %v", err)
		thumbnailUrl = ""
	}
	vid := &models.Video{
		YoutubeID:             &data.Items[0].ID,
		Title:                 data.Items[0].Snippet.Title,
		Url:                   &ytUrl,
		Description:           stripUrlsFromDescription(data.Items[0].Snippet.Description),
		ChannelTitle:          &data.Items[0].Snippet.ChannelTitle,
		Availability:          models.VideoProcessing,
		ThumbnailUrl:          thumbnailUrl,
		VisibilityStatus:      false,
		OpenContentProviderID: vs.OpenContentProviderID,
	}
	err = vs.db.WithContext(ctx).Create(vid).Error
	if err != nil {
		logger().Errorf("Error creating video: %v", err)
	}
	err = vs.downloadVideo(ctx, ytUrl, vid)
	if err != nil {
		logger().Errorf("Error updating video: %v", err)
	}
	return nil
}

func (yt *VideoService) incrementFailedAttempt(ctx context.Context, vid *models.Video, vidError string) error {
	var numAttempts int64
	if err := yt.db.WithContext(ctx).Model(&models.VideoDownloadAttempt{}).Where("video_id = ?", vid.ID).Count(&numAttempts).Error; err != nil {
		logger().Errorf("error counting download attempts: %v", err)
		return err
	}
	if numAttempts >= int64(MAX_DOWNLOAD_ATTEMPTS()) || vidError != "" {
		vid.Availability = models.VideoHasError
		if err := yt.db.WithContext(ctx).Save(vid).Error; err != nil {
			logger().Errorf("error updating video: %v", err)
			return err
		}
	}
	attempt := models.VideoDownloadAttempt{
		VideoID:      vid.ID,
		ErrorMessage: vidError,
	}
	return yt.db.WithContext(ctx).Create(&attempt).Error
}

func (yt *VideoService) downloadVideo(ctx context.Context, url string, vid *models.Video) error {
	opts := goutubedl.Options{
		Type:     goutubedl.TypeAny,
		DebugLog: logger(),
	}
	result, err := goutubedl.New(ctx, url, opts)
	if err != nil {
		logger().Errorf("error initiaing yt-dlp: %v", err)
		return err
	}
	logger().Println("info: ", result.Info)
	downloadResult, err := result.Download(ctx, "best")
	if err != nil {
		logger().Errorf("error downloading yt-dlp: %v", err)
		return err
	}
	defer downloadResult.Close()
	if vid == nil {
		thumbnail, err := yt.downloadAndHostThumbnail(result.Info.ID, result.Info.Thumbnail)
		if err != nil {
			thumbnail = "/youtube.png"
		}
		vid = &models.Video{
			Url:                   &url,
			Title:                 result.Info.Title,
			Description:           result.Info.Description,
			ChannelTitle:          &result.Info.Channel,
			Availability:          models.VideoProcessing,
			VisibilityStatus:      false,
			ThumbnailUrl:          thumbnail,
			OpenContentProviderID: yt.OpenContentProviderID,
		}
		if err := yt.db.WithContext(ctx).Create(vid).Error; err != nil {
			logger().Errorln(err)
		}
	}
	file, err := os.Create(fmt.Sprintf("%s/%s.mp4", os.Getenv("VIDEO_DOWNLOAD_DIR"), result.Info.ID))
	if err != nil {
		logger().Error(err)
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, downloadResult)
	if err != nil {
		logger().Errorf("error: %v copying downloaded video result", err)
		return err
	}
	vid.Availability = models.VideoAvailable
	return yt.db.WithContext(ctx).Save(vid).Error
}
