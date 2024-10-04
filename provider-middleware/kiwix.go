package main

import (
	"UnlockEdv2/src/models"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"time"

	log "github.com/sirupsen/logrus"

	"gorm.io/gorm"
)

// TODO:
// - Make sure to get the provider id (from the body) so that we only update Kiwix libraries
// - fix hard coding of kiwix library

type KiwixService struct {
	OpenContentProviderId uint
	Url                   string
}

func NewKiwixService(openContentProvider *models.OpenContentProvider) *KiwixService {
	openContentProvider.Url = "https://library.kiwix.org/catalog/v2/entries?lang=eng&start=1&count=10"
	return &KiwixService{
		OpenContentProviderId: openContentProvider.ID,
		Url:                   openContentProvider.Url,
	}
}

func (ks *KiwixService) ImportLibraries(db *gorm.DB) error {
	log.Println("Importing libraries from Kiwix")
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

	log.Printf("Found %v libraries from Kiwix", len(feed.Entries))

	var externalIds []string
	for _, entry := range feed.Entries {
		externalIds = append(externalIds, entry.ID)

		err = UpdateOrInsertLibrary(db, entry, ks.OpenContentProviderId)
		if err != nil {
			log.Errorf("error updating or inserting library: %v", err)
			return err
		}
	}

	var count int64
	count, err = RemoveDeletedEntries(db, externalIds, ks.OpenContentProviderId)
	if err != nil {
		log.Errorf("error removing deleted entries: %v", err)
		return err
	}
	log.Printf("Removed %v deleted libraries", count)

	return nil
}

func UpdateOrInsertLibrary(db *gorm.DB, entry Entry, providerId uint) error {
	log.Println("Attempting to update existing Kiwix Libraries.")

	library := &models.Library{}
	err := db.Model(&models.Library{}).First(&library, "external_id = ?", entry.ID).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("Could not find existing library for entry %v, creating new one", entry.ID)
			library = IntoLibrary(entry, providerId)
			if err := db.Create(&library).Error; err != nil {
				log.Errorf("Failed to insert library: %v", err)
				return err
			}
			return nil
		}
		return err
	}

	// Update library
	entryLastUpdatedAt, err := time.Parse("2006-01-02T15:04:05Z07:00", entry.Updated)
	if err != nil {
		log.Errorf("Failed to parse entry updated date: %v", err)
		return err
	}
	if entryLastUpdatedAt.After(library.UpdatedAt) {
		log.Printf("Updating existing library for entry %v", entry.ID)
		url, imageUrl := ParseUrls(entry.Links)
		library.Name = entry.Name
		library.Description = models.StringPtr(entry.Summary)
		library.Url = *models.StringPtr(url)
		library.ImageUrl = models.StringPtr(imageUrl)
		library.Language = models.StringPtr(entry.Language)
		if err := db.Save(&library).Error; err != nil {
			log.Errorf("Failed to save library: %v", err)
			return err
		}
	}

	return nil
}

func RemoveDeletedEntries(db *gorm.DB, externalIds []string, providerId uint) (int64, error) {
	log.Println("Removing any deleted Kiwix libraries")

	tx := db.Where("open_content_provider_id = ?", providerId).Delete(&models.Library{}, "external_id NOT IN (?)", externalIds)
	if tx.Error != nil {
		return 0, tx.Error
	}

	return tx.RowsAffected, nil
}
