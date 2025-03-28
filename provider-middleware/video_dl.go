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
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
	"github.com/wader/goutubedl"
	"gorm.io/gorm"
)

type Thumbnail struct {
	Url    string  `json:"url"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

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

type VideoService struct {
	BaseUrl               string
	OpenContentProviderID uint
	Client                *http.Client
	Body                  *map[string]interface{}
	db                    *gorm.DB
	bucketName            string
	s3Svc                 *s3.Client
	apiKey                string
}

const YtQueryParams = "&part=snippet,statistics&fields=items(id,snippet,statistics)"

func NewVideoService(prov *models.OpenContentProvider, db *gorm.DB, body *map[string]interface{}) *VideoService {
	// in development, this needs to remain empty unless you have s3 access
	bucketName := os.Getenv("S3_BUCKET_NAME")
	apiKey := os.Getenv("YOUTUBE_API_KEY")
	var svc *s3.Client = nil
	if bucketName != "" {
		logger().Info("s3 bucket found, creating client")
		cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(os.Getenv("AWS_REGION")))
		if err != nil {
			logger().Fatal(err)
		}
		svc = s3.NewFromConfig(cfg)
	}
	return &VideoService{
		BaseUrl:               prov.Url,
		Client:                &http.Client{},
		Body:                  body,
		OpenContentProviderID: prov.ID,
		db:                    db,
		s3Svc:                 svc,
		bucketName:            bucketName,
		apiKey:                apiKey,
	}
}

func (yt *VideoService) uploadFileToS3(ctx context.Context, file *os.File, video *models.Video) error {
	logger().Infof("Uploading to bucket: %s, key: %s", yt.bucketName, video.GetS3KeyMp4())
	uploadParams := &s3.PutObjectInput{
		Bucket:      aws.String(yt.bucketName),
		Key:         aws.String(video.GetS3KeyMp4()),
		Body:        file,
		ContentType: aws.String("video/mp4"),
	}

	output, err := yt.s3Svc.PutObject(ctx, uploadParams)
	if err != nil {
		logger().Errorf("error uploading file to s3: %v", err)
		return err
	}
	logger().Infof("Successfully uploaded file to %s/%s with ETAG: %s", yt.bucketName, video.GetS3KeyMp4(), *output.ETag)
	videoBytes, err := json.Marshal(video)
	if err != nil {
		logger().Errorf("error marshalling video: %v", err)
		return err
	}
	logger().Infof("Uploading to bucket: %s, key: %s", yt.bucketName, video.GetS3KeyJson())
	uploadJson := &s3.PutObjectInput{
		Bucket:      aws.String(yt.bucketName),
		Key:         aws.String(video.GetS3KeyJson()),
		Body:        bytes.NewReader(videoBytes),
		ContentType: aws.String("application/json"),
	}
	jsonOutput, err := yt.s3Svc.PutObject(ctx, uploadJson)
	if err != nil {
		logger().Errorf("error uploading file to s3: %v", err)
		return err
	}
	logger().Infof("Successfully uploaded file to %s/%s with ETAG: %s", yt.bucketName, video.GetS3KeyJson(), *jsonOutput.ETag)
	return nil
}

func (yt *VideoService) putAllCurrentVideoMetadata(ctx context.Context) error {
	if yt.s3Svc == nil {
		logger().Info("no s3 client found, skipping sync")
		return nil
	}
	videos := make([]models.Video, 0, 25)
	if err := yt.db.WithContext(ctx).Find(&videos).Error; err != nil {
		logger().Errorf("error fetching videos: %v", err)
		return err
	}
	for _, video := range videos {
		videoBytes, err := json.Marshal(video)
		if err != nil {
			logger().Errorf("error marshalling video %d: %v", video.ID, err)
			return err
		}
		input := &s3.PutObjectInput{
			Bucket:      aws.String(yt.bucketName),
			Body:        bytes.NewReader(videoBytes),
			Key:         aws.String(video.GetS3KeyJson()),
			IfNoneMatch: aws.String(video.GetS3KeyJson()),
		}
		resp, err := yt.s3Svc.PutObject(ctx, input)
		if err != nil {
			logger().Errorf("error putting object for video %d: %v", video.ID, err)
			return err
		}
		if resp.ETag == nil {
			logger().Errorf("etag is nil for video %d", video.ID)
			return nil
		}
		logger().Infof("successfully put object for video %d with etag: %s", video.ID, *resp.ETag)
	}
	return nil
}

func (yt *VideoService) syncVideoMetadataFromS3(ctx context.Context) error {
	if yt.s3Svc == nil {
		logger().Info("no s3 client found, skipping sync")
		return nil
	}
	input := &s3.ListObjectsV2Input{
		Bucket:    aws.String(yt.bucketName),
		Delimiter: aws.String("/videos/"),
	}
	var jsonFiles []string

	page, err := yt.s3Svc.ListObjectsV2(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to list objects in bucket %s: %w", yt.bucketName, err)
	}
	for _, item := range page.Contents {
		if strings.HasSuffix(*item.Key, ".json") {
			jsonFiles = append(jsonFiles, *item.Key)
		}
	}
	if len(jsonFiles) == 0 {
		return nil
	}
	for _, key := range jsonFiles {
		select {
		case <-ctx.Done():
			return ctx.Err() // Exit if the context is canceled
		default:
			ytId := strings.TrimSuffix(strings.TrimPrefix(key, "videos/"), ".json")
			if ytId == "" {
				continue
			}

			if yt.db.WithContext(ctx).Find(&models.Video{}, "external_id = ?", ytId).RowsAffected > 0 {
				logger().Infof("video with external_id %v already exists", ytId)
				continue
			}

			obj, err := yt.s3Svc.GetObject(ctx, &s3.GetObjectInput{
				Bucket: aws.String(yt.bucketName),
				Key:    aws.String(key),
			})
			if err != nil {
				logger().Errorf("error getting video json from s3: %v", err)
				continue
			}
			defer obj.Body.Close()
			video := &models.Video{}
			if err := json.NewDecoder(obj.Body).Decode(video); err != nil {
				logger().Errorf("error decoding video json: %v", err)
				continue
			}
			if strings.Contains(video.Url, "youtu") {
				_, err := yt.fetchYoutubeInfo(ctx, video.Url)
				if err != nil {
					if _, _, err := yt.fetchAndSaveInitialVideoInfo(ctx, video.Url, true); err != nil {
						logger().Errorf("error fetching video info: %v", err)
					}
				}
			} else {
				if _, _, err := yt.fetchAndSaveInitialVideoInfo(ctx, video.Url, true); err != nil {
					logger().Errorf("error fetching video info: %v", err)
				}
			}
		}
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
	for key, value := range map[string]string{"filename": filename, "size": fmt.Sprintf("%d", len(imgData)), "type": "image/jpg"} {
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
	req, err = http.NewRequest(http.MethodPost, os.Getenv("APP_URL")+"/upload", body)
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

func (vs *VideoService) retryFailedVideos(ctx context.Context) error {
	videos := make([]models.Video, 0)
	if err := vs.db.WithContext(ctx).Model(&models.Video{}).Find(&videos, "availability <> 'available'").Error; err != nil {
		logger().Errorf("error fetching failed videos: %v", err)
	}
	for _, video := range videos {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if err := vs.retrySingleVideo(ctx, int(video.ID)); err != nil {
				logger().Errorf("error retrying single video: %v", err)
				err = vs.incrementFailedAttempt(ctx, &video, err.Error())
				if err != nil {
					logger().Error("error incrementing failed attempt ", err)
					continue
				}
			}
		}
	}
	return nil
}

func (vs *VideoService) videoExistsInS3(ctx context.Context, ytId string) bool {
	if vs.s3Svc == nil {
		return false
	}
	input := &s3.HeadObjectInput{
		Bucket: aws.String(vs.bucketName),
		Key:    aws.String(fmt.Sprintf("/videos/%s.mp4", ytId)),
	}
	_, err := vs.s3Svc.HeadObject(ctx, input)
	return err == nil
}

func (vs *VideoService) retrySingleVideo(ctx context.Context, videoId int) error {
	var video models.Video
	if err := vs.db.WithContext(ctx).Preload("Attempts").First(&video, videoId).Error; err != nil {
		logger().Errorf("error fetching video: %v", err)
		return vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	if video.Availability == models.VideoAvailable {
		logger().Errorf("video %s is already available", video.ExternalID)
		return nil
	}
	// prevent attempts to retry the video within 30 mins of creation or 10 mins of a recent failed attempt
	if video.Availability == models.VideoProcessing && (video.CreatedAt.After(time.Now().Add(-30*time.Minute)) || video.HasRecentAttempt()) {
		logger().Errorf("video %s was retried while still processing", video.ExternalID)
		return nil
	}
	err := vs.downloadVideo(ctx, nil, &video)
	if err != nil {
		logger().Errorf("error downloading video: %v", err)
		return vs.incrementFailedAttempt(ctx, &video, err.Error())
	}
	return nil
}

func (yt *VideoService) addVideos(ctx context.Context) error {
	params := *yt.Body
	urls := params["video_urls"].([]interface{})
	logger().Infof("Adding videos: %v", urls)

	for idx := range urls {
		urlStr := urls[idx].(string)
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			var videoExists bool
			tx := yt.db.WithContext(ctx).Model(&models.Video{}).Select("count(*) > 0")
			if strings.Contains(urlStr, "youtu") {
				tx = tx.Where("external_id = ?", ytIdFromUrl(urlStr))
			} else {
				tx = tx.Where("url = ?", urlStr)
			}
			if err := tx.Scan(&videoExists).Error; err != nil || videoExists {
				logger().Errorf("video already exists: %v", urlStr)
				continue
			}
			result, vid, err := yt.fetchAndSaveInitialVideoInfo(ctx, urlStr, false)
			if err != nil {
				logger().Errorf("Error fetching video info: %v", err)
				continue
			}
			err = yt.downloadVideo(ctx, result, vid)
			if err != nil {
				logger().Errorf("Error downloading video: %v", err)
				continue
			}
		}
	}
	return nil
}

func (vs *VideoService) fetchYoutubeInfo(ctx context.Context, ytUrl string) (*models.Video, error) {
	parsed, err := url.Parse(ytUrl)
	if err != nil {
		logger().Errorf("Error parsing url: %v", err)
		return nil, err
	}
	id := parsed.Query().Get("v")
	finalUrl := fmt.Sprintf("%s?id=%s&key=%s%s", vs.BaseUrl, id, vs.apiKey, YtQueryParams)
	logger().Infof("url to fetch video: %s", finalUrl)
	resp, err := http.Get(finalUrl)
	if err != nil {
		logger().Errorf("Error getting video: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	var data YoutubeDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		logger().Errorf("Error decoding video info: %v", err)
		return nil, err
	}
	if len(data.Items) == 0 {
		logger().Errorf("Video not found in response from youtube API")
		return nil, fmt.Errorf("Video %s not found", id)
	}
	logger().Infof("Adding videos: %v", data)
	url := data.Items[0].Snippet.Thumbnails.High.Url
	if url == "" {
		url = data.Items[0].Snippet.Thumbnails.Default.Url
	}
	thumbnailUrl, err := vs.downloadAndHostThumbnail(data.Items[0].ID, url)
	if err != nil {
		logrus.Errorf("Error downloading and hosting thumbnail: %v", err)
		thumbnailUrl = ""
	}
	vid := &models.Video{
		ExternalID:            data.Items[0].ID,
		Title:                 data.Items[0].Snippet.Title,
		Url:                   ytUrl,
		Description:           stripUrlsFromDescription(data.Items[0].Snippet.Description),
		ChannelTitle:          &data.Items[0].Snippet.ChannelTitle,
		Availability:          models.VideoProcessing,
		ThumbnailUrl:          thumbnailUrl,
		OpenContentProviderID: vs.OpenContentProviderID,
	}
	err = vs.db.WithContext(ctx).Create(vid).Error
	if err != nil {
		logrus.Errorf("Error creating video: %v", err)
	}
	return vid, err
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

func (yt *VideoService) fetchAndSaveInitialVideoInfo(ctx context.Context, vidUrl string, avail bool) (*goutubedl.Result, *models.Video, error) {
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
	externId := result.Info.ID
	if strings.Contains("youtu", vidUrl) {
		externId = ytIdFromUrl(vidUrl)
	}
	vid := &models.Video{
		Title:                 result.Info.Title,
		Description:           stripUrlsFromDescription(result.Info.Description),
		ChannelTitle:          &result.Info.Channel,
		ExternalID:            externId,
		Url:                   vidUrl,
		ThumbnailUrl:          thumbnail,
		Duration:              int(result.Info.Duration),
		OpenContentProviderID: yt.OpenContentProviderID,
	}
	if avail {
		vid.Availability = models.VideoAvailable
	} else {
		vid.Availability = models.VideoProcessing
	}
	if err := yt.db.WithContext(ctx).Create(vid).Error; err != nil {
		logger().Errorln(err)
		return nil, nil, err
	}
	return &result, vid, err
}

func ytIdFromUrl(url string) string {
	if !strings.Contains(url, "v=") && strings.Contains(url, "youtu.be") {
		parts := strings.Split(url, "//")
		if len(parts) < 2 {
			return ""
		}
		rest := strings.Split(strings.Split(parts[1], "?")[0], "/")[1]
		return rest
	}
	if strings.Contains(url, "v=") {
		parts := strings.Split(url, "v=")
		if len(parts) < 2 {
			return ""
		}
		return strings.Split(parts[1], "&")[0]
	}
	return ""
}

// can be called vith the existing goutubedl.Result, or nil and it will fetch the info again
func (yt *VideoService) downloadVideo(ctx context.Context, vidInfo *goutubedl.Result, video *models.Video) error {
	if vidInfo == nil {
		result, err := goutubedl.New(ctx, video.Url, goutubedl.Options{
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
	if yt.videoExistsInS3(ctx, vidInfo.Info.ID) {
		return nil
	}
	downloadResult, err := vidInfo.Download(ctx, "best")
	if err != nil {
		logger().Errorf("error downloading yt-dlp: %v", err)
		return err
	}
	defer downloadResult.Close()
	file, err := os.Create(fmt.Sprintf("/videos/%s.mp4", vidInfo.Info.ID))
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
	if err := file.Sync(); err != nil {
		logger().Errorf("error syncing file: %v", err)
		return err
	}
	if _, err = file.Seek(0, 0); err != nil {
		logger().Errorf("error resetting file: %v", err)
		return err
	}
	if yt.s3Svc != nil {
		err := yt.uploadFileToS3(ctx, file, video)
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
