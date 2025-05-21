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
	"path/filepath"
	"strings"
	"time"

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
	Body                  *map[string]any
	db                    *gorm.DB
}

func NewVideoService(prov *models.OpenContentProvider, db *gorm.DB, body *map[string]any) *VideoService {
	return &VideoService{
		BaseUrl:               prov.Url,
		Client:                &http.Client{},
		Body:                  body,
		OpenContentProviderID: prov.ID,
		db:                    db,
	}
}

// this function finds all videos in the mounted s3 directory and ensures the Database is completely in sync,
// adding any videos from the .json metadata, and writing out .json metadata for each video in the database not present
// since we are mounting shared directories (s3 backed) to use for the thumbnails, we no longer have to worry about running
// the downloader to get the thumbnail when we find a file we don't have, the relative URL of '/photos/external_id.jpg'
// will work across all nodes as long as PVs are properly mounted to the pods.
func (yt *VideoService) syncVideoMetadata(ctx context.Context) error {
	var jsonIDs []string
	directory := "/videos/"
	dir, err := os.ReadDir(directory)
	if err != nil {
		logger().Errorf("Error reading mounted s3 directory: %v", err)
		return err
	}

	// walk the directory and gather all video id's from json filenames
	for _, file := range dir {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			if strings.HasSuffix(file.Name(), ".json") {
				id := strings.TrimSuffix(file.Name(), ".json")
				if id != "" {
					jsonIDs = append(jsonIDs, id)
				}
			}
		}
	}
	if len(jsonIDs) == 0 {
		return nil
	}
	var count int64
	if err := yt.db.WithContext(ctx).Model(&models.Video{}).Count(&count).Error; err != nil {
		logger().Errorf("error counting videos in DB: %v", err)
		return err
	}
	// early return if we are already sync'd (common path)
	if int(count) == len(jsonIDs) {
		return nil
	}

	// fetch existing video IDs from DB that match any json file
	var existingVideos []string
	if err := yt.db.WithContext(ctx).
		Model(&models.Video{}).
		Where("external_id IN ?", jsonIDs).
		Pluck("external_id", &existingVideos).Error; err != nil {
		logger().Errorf("error fetching existing video IDs from DB: %v", err)
		return err
	}

	existingMap := make(map[string]struct{}, len(existingVideos))
	for _, id := range existingVideos {
		existingMap[id] = struct{}{}
	}

	// load any new videos from JSON that are not in DB
	for _, id := range jsonIDs {
		if _, exists := existingMap[id]; exists {
			continue
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			path := filepath.Join(directory, id+".json")
			data, err := os.ReadFile(path)
			if err != nil {
				logger().Errorf("failed to read %s: %v", path, err)
				continue
			}
			var video models.Video
			if err := json.Unmarshal(data, &video); err != nil {
				logger().Errorf("failed to parse %s: %v", path, err)
				continue
			}
			if err := yt.db.WithContext(ctx).Create(&video).Error; err != nil {
				logger().Errorf("failed to insert video %s into db: %v", id, err)
			}
		}
	}

	// fetch videos in DB that don't exist as json files (unlikely path)
	var missingFiles []models.Video
	if err := yt.db.WithContext(ctx).
		Model(&models.Video{}).
		Where("external_id NOT IN ?", jsonIDs).
		Find(&missingFiles).Error; err != nil {
		logger().Errorf("error fetching videos missing from disk: %v", err)
		return err
	}
	if len(missingFiles) == 0 {
		return nil
	}

	// write missing videos to disk
	for _, video := range missingFiles {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			data, err := json.Marshal(video)
			if err != nil {
				logger().Errorf("error serializing video %s: %v", video.ExternalID, err)
				continue
			}
			path := filepath.Join(directory, video.ExternalID+".json")
			if err := os.WriteFile(path, data, 0644); err != nil {
				logger().Errorf("error writing video %s: %v", video.ExternalID, err)
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
	defer func() {
		if resp.Body.Close() != nil {
			logger().Errorf("error closing response body: %v", err)
		}
	}()
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
	defer func() {
		if uploadResp.Body.Close() != nil {
			logger().Errorf("error closing upload response body: %v", err)
		}
	}()
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

func (vs *VideoService) videoIsPresent(ytId string) bool {
	fileName := fmt.Sprintf("/videos/%s.mp4", ytId)
	_, err := os.Stat(fileName)
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
	urls := params["video_urls"].([]any)
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

	// if we already have the video on disk, skip the download
	if yt.videoIsPresent(vidInfo.Info.ID) {
		return nil
	}
	downloadResult, err := vidInfo.Download(ctx, "b")
	if err != nil {
		logger().Errorf("error downloading yt-dlp: %v", err)
		return err
	}
	defer func() {
		if downloadResult.Close() != nil {
			logger().Errorf("error closing response body: %v", err)
		}
	}()
	file, err := os.Create(fmt.Sprintf("/videos/%s.mp4", vidInfo.Info.ID))
	if err != nil {
		logger().Error(err)
		return err
	}
	defer func() {
		if file.Close() != nil {
			logger().Errorf("error closing response body: %v", err)
		}
	}()
	_, err = io.Copy(file, downloadResult)
	if err != nil {
		logger().Errorf("error: %v copying downloaded video result", err)
		return err
	}
	err = file.Sync()
	if err != nil {
		logger().Errorf("Error syncing file: %v", err)
	}
	video.Availability = models.VideoAvailable
	jsonData, err := json.Marshal(video)
	if err != nil {
		logger().Errorf("Error marshalling json for newly downloaded video, not a fatal error: %v", err)
	}
	// write json metadata file to disk
	fileName := fmt.Sprintf("/videos/%s.json", video.ExternalID)
	jsonFile, err := os.Create(fileName)
	if err != nil {
		logger().Errorf("error creating json file: %v", err)
	}
	_, err = jsonFile.Write(jsonData)
	if err != nil {
		logger().Errorf("error writing json file: %v", err)
	}
	return yt.db.WithContext(ctx).Save(video).Error
}
