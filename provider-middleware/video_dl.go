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
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/wader/goutubedl"
	"gorm.io/gorm"
)

type Thumbnail struct {
	Url    string  `json:"url"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type VideoService struct {
	BaseUrl               string
	OpenContentProviderID uint
	Client                *http.Client
	Body                  *map[string]interface{}
	db                    *gorm.DB
	bucketName            string
}

func NewVideoService(prov *models.OpenContentProvider, db *gorm.DB, body *map[string]interface{}) *VideoService {
	// in development, this needs to remain empty unless you have s3 access
	bucketName := os.Getenv("BUCKET_NAME")
	return &VideoService{
		BaseUrl:               prov.BaseUrl,
		Client:                &http.Client{},
		Body:                  body,
		OpenContentProviderID: prov.ID,
		db:                    db,
		bucketName:            bucketName,
	}
}

func (yt *VideoService) uploadFileToS3(ctx context.Context, file *os.File) error {
	sess := session.Must(session.NewSession())
	svc := s3.New(sess)
	uploadParams := &s3.PutObjectInput{
		Bucket:      aws.String(yt.bucketName),
		Key:         aws.String(file.Name()),
		Body:        file,
		ContentType: aws.String("video/mp4"),
	}
	_, err := svc.PutObjectWithContext(ctx, uploadParams)
	if err != nil {
		logger().Errorf("error uploading file to s3: %v", err)
		return err
	}
	return nil
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
	if err := vs.db.WithContext(ctx).Preload("Attempts").First(&video, videoId).Error; err != nil {
		logger().Errorf("error fetching video: %v", err)
		return vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	if video.Availability == models.VideoAvailable {
		logger().Errorf("video is already available")
		return nil
	}
	// prevent attempts to retry the video within 30 mins of creation or 10 mins of a recent failed attempt
	if video.Availability == models.VideoProcessing && (video.CreatedAt.After(time.Now().Add(-30*time.Minute)) || video.HasRecentAttempt()) {
		logger().Errorf("video was retried while still processing")
		return nil
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
	err := vs.downloadVideo(ctx, nil, &video)
	if err != nil {
		logger().Errorf("error downloading video: %v", err)
		return vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	return nil
}

func (yt *VideoService) AddVideos(ctx context.Context) error {
	params := *yt.Body
	urls := params["video_urls"].([]interface{})
	logger().Infof("Adding videos: %v", urls)

	var wg sync.WaitGroup
	wg.Add(len(urls))

	for idx := range urls {
		urlStr := urls[idx].(string)
		go func(url string) {
			defer wg.Done()
			select {
			case <-ctx.Done():
				return
			default:
				var videoExists bool
				if err := yt.db.WithContext(ctx).Model(&models.Video{}).Select("count(*) > 0").Where("url = ?", url).Scan(&videoExists).Error; err != nil {
					logger().Errorf("error checking if video exists: %v", err)
					return
				}
				if videoExists {
					return
				}
				result, vid, err := yt.fetchAndSaveInitialVideoInfo(ctx, url)
				if err != nil {
					logger().Errorf("Error fetching video info: %v", err)
					return
				}
				err = yt.downloadVideo(ctx, result, vid)
				if err != nil {
					logger().Errorf("Error downloading video: %v", err)
					return
				}
			}
		}(urlStr)
	}
	wg.Wait()
	return nil
}

func (yt *VideoService) incrementFailedAttempt(ctx context.Context, vid *models.Video, vidError string) error {
	var numAttempts int64
	if err := yt.db.WithContext(ctx).Model(&models.VideoDownloadAttempt{}).Where("video_id = ?", vid.ID).Count(&numAttempts).Error; err != nil {
		logger().Errorf("error counting download attempts: %v", err)
		return err
	}
	if numAttempts >= int64(models.MAX_DOWNLOAD_ATTEMPTS) {
		if err := yt.db.WithContext(ctx).Delete(vid).Error; err != nil {
			logger().Errorf("error deleting video: %v", err)
			return err
		}
		return nil
	}
	attempt := models.VideoDownloadAttempt{
		VideoID:      vid.ID,
		ErrorMessage: vidError,
	}
	if vidError != "" {
		vid.Availability = models.VideoHasError
		if err := yt.db.Save(vid).Error; err != nil {
			logger().Errorf("error saving video: %v", err)
		}
	}
	return yt.db.WithContext(ctx).Create(&attempt).Error
}

func (yt *VideoService) fetchAndSaveInitialVideoInfo(ctx context.Context, vidUrl string) (*goutubedl.Result, *models.Video, error) {
	result, err := goutubedl.New(ctx, vidUrl, goutubedl.Options{
		Type:     goutubedl.TypeAny,
		DebugLog: logger(),
	})
	if err != nil {
		logger().Errorf("error initiaing yt-dlp: %v", err)
		return nil, nil, err
	}
	logger().Println("info: ", result.Info)
	thumbnail, err := yt.downloadAndHostThumbnail(result.Info.ID, result.Info.Thumbnail)
	if err != nil {
		thumbnail = "/youtube.png"
	}
	vid := &models.Video{
		Title:                 result.Info.Title,
		Description:           stripUrlsFromDescription(result.Info.Description),
		ChannelTitle:          &result.Info.Channel,
		Availability:          models.VideoProcessing,
		YoutubeID:             &result.Info.ID,
		VisibilityStatus:      false,
		Url:                   &vidUrl,
		ThumbnailUrl:          thumbnail,
		OpenContentProviderID: yt.OpenContentProviderID,
	}
	if err := yt.db.WithContext(ctx).Create(vid).Error; err != nil {
		logger().Errorln(err)
		return nil, nil, err
	}
	return &result, vid, err
}

// can be called vith the existing goutubedl.Result, or nil and it will fetch the info again
func (yt *VideoService) downloadVideo(ctx context.Context, vidInfo *goutubedl.Result, video *models.Video) error {
	if vidInfo == nil {
		result, err := goutubedl.New(ctx, *video.Url, goutubedl.Options{
			Type:     goutubedl.TypeAny,
			DebugLog: logger(),
		})
		if err != nil {
			logger().Errorf("error initiaing yt-dlp: %v", err)
			return err
		}
		logger().Println("info: ", result.Info)
		vidInfo = &result
	}
	downloadResult, err := vidInfo.Download(ctx, "best")
	if err != nil {
		logger().Errorf("error downloading yt-dlp: %v", err)
		return err
	}
	defer downloadResult.Close()
	file, err := os.Create(fmt.Sprintf("%s/%s.mp4", os.Getenv("VIDEO_DOWNLOAD_DIR"), vidInfo.Info.ID))
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
	if yt.bucketName != "" {
		err := yt.uploadFileToS3(ctx, file)
		if err != nil {
			logger().Errorf("error reading download result: %v", err)
			return err
		}
		err = os.Remove(file.Name())
		if err != nil {
			logger().Errorf("error reading download result: %v", err)
			return err
		}
	}
	video.Availability = models.VideoAvailable
	return yt.db.WithContext(ctx).Save(video).Error
}
