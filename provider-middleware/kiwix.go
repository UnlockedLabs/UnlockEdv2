package main

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"

	"github.com/sirupsen/logrus"
	log "github.com/sirupsen/logrus"

	"gorm.io/gorm"
)

const (
	KiwixCatalogUrl = "/catalog/v2/entries?lang=eng&start=1&count="
	MaxLibraries    = 1000
)

type KiwixService struct {
	OpenContentProviderId uint
	Url                   string
	params                *map[string]interface{}
}

func NewKiwixService(openContentProvider *models.OpenContentProvider, params *map[string]interface{}) *KiwixService {
	url := fmt.Sprintf("%s%s%d", openContentProvider.BaseUrl, KiwixCatalogUrl, MaxLibraries)
	return &KiwixService{
		OpenContentProviderId: openContentProvider.ID,
		Url:                   url,
		params:                params,
	}
}

func (ks *KiwixService) GetJobParams() *map[string]interface{} {
	return ks.params
}

func (ks *KiwixService) ImportLibraries(ctx context.Context, db *gorm.DB) error {
	log.Infoln("Importing libraries from Kiwix")
	resp, err := http.Get(ks.Url)
	if err != nil {
		log.Errorf("error fetching data from url: %v", err)
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Errorf("error reading data: %v", err)
		return err
	}
	var feed Feed
	err = xml.Unmarshal(body, &feed)
	if err != nil {
		log.Errorf("error parsing data: %v", err)
		return err
	}
	log.Infof("Found %v libraries from Kiwix", len(feed.Entries))

	var externalIds []string
	for _, entry := range feed.Entries {
		select {
		case <-ctx.Done():
			log.Infoln("Context cancelled, stopping import")
			return nil
		default:
			externalIds = append(externalIds, entry.ID)
			err = UpdateOrInsertLibrary(ctx, db, entry, ks.OpenContentProviderId)
			if err != nil {
				log.Errorf("error updating or inserting library: %v", err)
				return err
			}
		}
	}
	removed, err := RemoveDeletedEntries(ctx, db, externalIds, ks.OpenContentProviderId)
	if err != nil {
		log.Errorf("error removing deleted entries: %v", err)
		return err
	}
	log.Infof("Removed %v deleted libraries", removed)
	return nil
}

func UpdateOrInsertLibrary(ctx context.Context, db *gorm.DB, entry Entry, providerId uint) error {
	log.Infoln("Attempting to update existing Kiwix Libraries.")
	library := IntoLibrary(entry, providerId)
	if err := db.WithContext(ctx).
		Where(&models.Library{ExternalID: models.StringPtr(entry.ID)}).
		Assign(models.Library{
			Path:        library.Path,
			Name:        library.Name,
			Description: library.Description,
			Language:    library.Language}).
		FirstOrCreate(&library).Error; err != nil {
		logrus.Errorln("Error updating or inserting library: ", err)
		return err
	}
	return nil
}

func RemoveDeletedEntries(ctx context.Context, db *gorm.DB, externalIds []string, providerId uint) (int64, error) {
	log.Infoln("Removing any deleted Kiwix libraries")

	tx := db.WithContext(ctx).Where("open_content_provider_id = ?", providerId).Delete(&models.Library{}, "external_id NOT IN (?)", externalIds)
	if tx.Error != nil {
		return 0, tx.Error
	}

	return tx.RowsAffected, nil
}
