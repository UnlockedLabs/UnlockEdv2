package main

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"

	"gorm.io/gorm"
)

const (
	KiwixCatalogUrl = "/catalog/v2/entries?lang=eng&start=1&count="
	MaxLibraries    = 1000
)

type KiwixService struct {
	OpenContentProviderId uint
	Url                   string
	BaseUrl               string
	Client                *http.Client
	JobID                 string
	params                *map[string]interface{}
}

func NewKiwixService(openContentProvider *models.OpenContentProvider, params *map[string]interface{}) *KiwixService {
	url := fmt.Sprintf("%s%s%d", openContentProvider.BaseUrl, KiwixCatalogUrl, MaxLibraries)
	client := http.Client{}
	jobID := (*params)["job_id"].(string)
	return &KiwixService{
		OpenContentProviderId: openContentProvider.ID,
		BaseUrl:               openContentProvider.BaseUrl,
		Url:                   url,
		params:                params,
		Client:                &client,
		JobID:                 jobID,
	}
}

func (ks *KiwixService) ImportLibraries(ctx context.Context, db *gorm.DB) error {
	logger().Infoln("Importing libraries from Kiwix")
	req, err := http.NewRequest(http.MethodGet, ks.Url, nil)
	if err != nil {
		logger().Errorf("error creating request: %v", err)
		return err
	}
	resp, err := ks.Client.Do(req)
	if err != nil {
		logger().Errorf("error fetching data from url: %v", err)
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger().Errorf("error reading data: %v", err)
		return err
	}
	var feed Feed
	err = xml.Unmarshal(body, &feed)
	if err != nil {
		logger().Errorf("error parsing data: %v", err)
		return err
	}
	logger().Infof("Found %v libraries from Kiwix", len(feed.Entries))

	var externalIds []string
	for _, entry := range feed.Entries {
		select {
		case <-ctx.Done():
			logger().Infoln("Context cancelled, stopping import")
			return nil
		default:
			externalIds = append(externalIds, entry.ID)
			err = ks.UpdateOrInsertLibrary(ctx, db, entry, ks.OpenContentProviderId)
			if err != nil {
				logger().Errorf("error updating or inserting library: %v", err)
				return err
			}
		}
	}
	removed, err := RemoveDeletedEntries(ctx, db, externalIds, ks.OpenContentProviderId)
	if err != nil {
		logger().Errorf("error removing deleted entries: %v", err)
		return err
	}
	logger().Infof("Removed %v deleted libraries", removed)
	return nil
}

func (ks *KiwixService) UpdateOrInsertLibrary(ctx context.Context, db *gorm.DB, entry Entry, providerId uint) error {
	logger().Infoln("Attempting to update existing Kiwix Libraries.")
	library := ks.IntoLibrary(entry, providerId)
	if err := db.WithContext(ctx).
		Where(&models.Library{ExternalID: models.StringPtr(entry.ID)}).
		Assign(models.Library{
			Path:        library.Path,
			Name:        library.Name,
			Description: library.Description,
			Language:    library.Language,
			ImageUrl:    library.ImageUrl,
		}).
		FirstOrCreate(&library).Error; err != nil {
		logger().Errorln("Error updating or inserting library: ", err)
		return err
	}
	return nil
}

func RemoveDeletedEntries(ctx context.Context, db *gorm.DB, externalIds []string, providerId uint) (int64, error) {
	logger().Infoln("Removing any deleted Kiwix libraries")

	tx := db.WithContext(ctx).Where("open_content_provider_id = ?", providerId).Delete(&models.Library{}, "external_id NOT IN (?)", externalIds)
	if tx.Error != nil {
		return 0, tx.Error
	}

	return tx.RowsAffected, nil
}
