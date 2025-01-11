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

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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
	s3Svc                 *s3.Client
}

func NewVideoService(prov *models.OpenContentProvider, db *gorm.DB, body *map[string]interface{}) *VideoService {
	// in development, this needs to remain empty unless you have s3 access
	bucketName := os.Getenv("S3_BUCKET_NAME")
	var svc *s3.Client = nil
	if bucketName != "" {
		logger().Info("s3 bucket found, creating client")
		cfg, err := config.LoadDefaultConfig(context.Background(), config.WithClientLogMode(aws.LogRequest|aws.LogResponseWithBody), config.WithRegion("us-west-2"))
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
			Bucket: aws.String(yt.bucketName),
			Body:   bytes.NewReader(videoBytes),
			Key:    aws.String(video.GetS3KeyJson()),
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
	wg := sync.WaitGroup{}
	if len(jsonFiles) == 0 {
		return nil
	}
	wg.Add(len(jsonFiles))
	for _, key := range jsonFiles {
		go func(key string) {
			defer wg.Done()
			select {
			case <-ctx.Done():
				return
			default:
				ytId := strings.TrimSuffix(strings.TrimPrefix(key, "videos/"), ".json")
				if ytId == "" {
					return
				}
				if yt.db.WithContext(ctx).Find(&models.Video{}, "external_id = ?", ytId).RowsAffected > 0 {
					logger().Infof("video with external_id %v already exists", ytId)
					return
				}
				obj, err := yt.s3Svc.GetObject(ctx, &s3.GetObjectInput{
					Bucket: aws.String(yt.bucketName),
					Key:    aws.String(key),
				})
				if err != nil {
					logger().Errorf("error getting video json from s3: %v", err)
					return
				}
				defer obj.Body.Close()
				video := &models.Video{}
				if err := json.NewDecoder(obj.Body).Decode(video); err != nil {
					logger().Errorf("error decoding video json: %v", err)
					return
				}
				if _, _, err := yt.fetchAndSaveInitialVideoInfo(ctx, video.Url, true); err != nil {
					logger().Errorf("error fetching video info: %v", err)
				}
			}
		}(key)
	}
	wg.Wait()
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
	wg := sync.WaitGroup{}
	wg.Add(len(videos))
	for _, video := range videos {
		go func(video models.Video) {
			defer wg.Done()
			select {
			case <-ctx.Done():
				return
			default:
				if err := vs.retrySingleVideo(ctx, int(video.ID)); err != nil {
					logger().Errorf("error retrying single video: %v", err)
					err = vs.incrementFailedAttempt(ctx, &video, err.Error())
					if err != nil {
						logger().Error("error incrementing failed attempt ", err)
						return
					}
				}
			}
		}(video)
	}
	wg.Wait()
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
		logger().Errorf("video is already available")
		return nil
	}
	// prevent attempts to retry the video within 30 mins of creation or 10 mins of a recent failed attempt
	if video.Availability == models.VideoProcessing && (video.CreatedAt.After(time.Now().Add(-30*time.Minute)) || video.HasRecentAttempt()) {
		logger().Errorf("video was retried while still processing")
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
				result, vid, err := yt.fetchAndSaveInitialVideoInfo(ctx, url, false)
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
	vid := &models.Video{
		Title:                 result.Info.Title,
		Description:           stripUrlsFromDescription(result.Info.Description),
		ChannelTitle:          &result.Info.Channel,
		ExternalID:            result.Info.ID,
		VisibilityStatus:      false,
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
