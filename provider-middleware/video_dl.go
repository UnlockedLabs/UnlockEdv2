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

	"github.com/sirupsen/logrus"
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
		logrus.Errorf("error creating request: %v", err)
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "image/*")

	resp, err := yt.Client.Do(req)
	if err != nil {
		logrus.Errorf("error fetching thumbnail image from URL: %v", err)
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logrus.Errorf("failed to fetch thumbnail image: received %v response", resp.Status)
		return "", fmt.Errorf("failed to fetch thumbnail image: %v", resp.Status)
	}

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		logrus.Errorf("error reading thumbnail image: %v", err)
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
		logrus.Errorf("error closing writer: %v", err)
		return "", err
	}

	uploadURL := os.Getenv("APP_URL") + "/upload"
	req, err = http.NewRequest(http.MethodPost, uploadURL, body)
	if err != nil {
		logrus.Errorf("error creating upload request: %v", err)
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := yt.Client.Do(req)
	if err != nil {
		logrus.Errorf("error sending upload request: %v", err)
		return "", err
	}
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		logrus.Errorf("failed to upload image: received %v response", uploadResp.Status)
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
		logrus.Errorf("error decoding upload response: %v", err)
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
	if err := vs.db.WithContext(ctx).Find(&videos, "is_available = false").Error; err != nil {
		logrus.Errorf("error fetching failed videos: %v", err)
	}
	for _, video := range videos {
		if video.Url == nil {
			if video.YoutubeID == nil {
				logrus.Errorf("video has no url or youtube id, cannot proceed with download")
				if err := vs.incrementFailedAttempt(ctx, &video, "video has no url or youtube id"); err != nil {
					logrus.Errorf("error incrementing failed attempt: %v", err)
				}
				continue
			} else {
				video.Url = models.StringPtr(fmt.Sprintf("https://www.youtube.com/watch?v=%s", *video.YoutubeID))
			}
		}
		err := vs.downloadVideo(ctx, *video.Url, &video)
		if err != nil {
			logrus.Errorf("error downloading video: %v", err)
		}
	}
	return nil
}

func (yt *VideoService) AddVideos(ctx context.Context) error {
	params := *yt.Body
	urls := params["video_urls"].([]interface{})
	logrus.Infof("Adding videos: %v", urls)
	for idx := range urls {
		select {
		case <-ctx.Done():
			return nil
		default:
			urlStr := urls[idx].(string)
			if strings.Contains(urlStr, "youtube.com") {
				err := yt.fetchYoutubeInfo(ctx, urlStr)
				if err != nil {
					logrus.Errorf("Error fetching youtube info: %v", err)
				}
			} else {
				err := yt.downloadVideo(ctx, urlStr, nil)
				if err != nil {
					logrus.Errorf("Error downloading video: %v", err)
				}
			}
		}
	}
	return nil
}

func (vs *VideoService) fetchYoutubeInfo(ctx context.Context, ytUrl string) error {
	parsed, err := url.Parse(ytUrl)
	if err != nil {
		logrus.Errorf("Error parsing url: %v", err)
		return err
	}
	id := parsed.Query().Get("v")
	finalUrl := fmt.Sprintf("%s?id=%s&key=%s%s", vs.BaseUrl, id, vs.YtApiKey, YtQueryParams)
	logrus.Infof("url to fetch video: %s", finalUrl)
	resp, err := http.Get(finalUrl)
	if err != nil {
		logrus.Errorf("Error getting video: %v", err)
		return err
	}
	defer resp.Body.Close()
	var data YoutubeDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		logrus.Errorf("Error decoding video info: %v", err)
		return err
	}
	if len(data.Items) == 0 {
		logrus.Errorf("Video not found in response from youtube API")
		return fmt.Errorf("Video not found")
	}
	logrus.Infof("Adding videos: %v", data)
	thumbnailUrl, err := vs.downloadAndHostThumbnail(data.Items[0].ID, data.Items[0].Snippet.Thumbnails.High.Url)
	if err != nil {
		logrus.Errorf("Error downloading and hosting thumbnail: %v", err)
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
		VisibilityStatus:      true,
		OpenContentProviderID: vs.OpenContentProviderID,
	}
	err = vs.db.WithContext(ctx).Create(vid).Error
	if err != nil {
		logrus.Errorf("Error creating video: %v", err)
	}
	err = vs.downloadVideo(ctx, ytUrl, vid)
	if err != nil {
		logrus.Errorf("Error updating video: %v", err)
	}
	return nil
}

func (yt *VideoService) incrementFailedAttempt(ctx context.Context, vid *models.Video, vidError string) error {
	var numAttempts int64
	if err := yt.db.WithContext(ctx).Model(&models.VideoDownloadAttempt{}).Where("video_id = ?", vid.ID).Count(&numAttempts).Error; err != nil {
		logrus.Errorf("error counting download attempts: %v", err)
		return err
	}
	if numAttempts >= int64(MAX_DOWNLOAD_ATTEMPTS()) || vidError != "" {
		vid.Availability = models.VideoHasError
		if err := yt.db.WithContext(ctx).Save(vid).Error; err != nil {
			logrus.Errorf("error updating video: %v", err)
			return err
		}
	}
	attempt := models.VideoDownloadAttempt{
		VideoID: vid.ID,
		Error:   vidError,
	}
	return yt.db.WithContext(ctx).Create(&attempt).Error
}

func (yt *VideoService) downloadVideo(ctx context.Context, url string, vid *models.Video) error {
	result, err := goutubedl.New(context.Background(), url, goutubedl.Options{
		Type:     goutubedl.TypeAny,
		DebugLog: logrus.New(),
		ProxyUrl: "socks5://127.0.0.1:25432",
	})
	if err != nil {
		logrus.Errorf("error initiaing yt-dlp: %v", err)
		return err
	}
	logrus.Println("info: ", result.Info)
	downloadResult, err := result.Download(ctx, "best")
	if err != nil {
		logrus.Errorf("error downloading yt-dlp: %v", err)
		return err
	}
	defer downloadResult.Close()
	if vid == nil {
		vid = &models.Video{
			Url:                   &url,
			Title:                 result.Info.Title,
			Description:           result.Info.Description,
			ChannelTitle:          &result.Info.Channel,
			OpenContentProviderID: yt.OpenContentProviderID,
		}
		if err := yt.db.WithContext(ctx).Create(vid).Error; err != nil {
			logrus.Errorln(err)
		}
	}
	file, err := os.Create(fmt.Sprintf("%s/%s.mp4", os.Getenv("VIDEO_DOWNLOAD_DIR"), result.Info.ID))
	if err != nil {
		logrus.Error(err)
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, downloadResult)
	if err != nil {
		logrus.Errorf("error: %v copying downloaded video result", err)
		return err
	}
	vid.Availability = models.VideoAvailable
	return yt.db.WithContext(ctx).Save(vid).Error
}
