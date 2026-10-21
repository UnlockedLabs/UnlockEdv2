package opencontent

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	KiwixCatalogUrl = "/catalog/v2/entries?lang=eng&start=0&count="
	maxLibraries    = 1000
)

type KiwixService struct {
	OpenContentProviderId uint
	Url                   string
	BaseUrl               string
	Client                *http.Client
	params                map[string]any
}

func NewKiwixService(openContentProvider *OpenContentProvider, params map[string]any) *KiwixService {
	url := fmt.Sprintf("%s%s%d", openContentProvider.Url, KiwixCatalogUrl, maxLibraries)
	client := http.Client{}
	return &KiwixService{
		OpenContentProviderId: openContentProvider.ID,
		BaseUrl:               openContentProvider.Url,
		Url:                   url,
		params:                params,
		Client:                &client,
	}
}

func (ks *KiwixService) ImportLibraries(ctx context.Context, db *gorm.DB) error {
	log.Infoln("Importing libraries from Kiwix using the follwing url: ", ks.Url)
	req, err := http.NewRequest(http.MethodGet, ks.Url, nil)
	if err != nil {
		log.Errorf("error creating request: %v", err)
		return err
	}
	resp, err := ks.Client.Do(req)
	if err != nil {
		log.Errorf("error fetching data from url: %v", err)
		return err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Errorf("error closing response body: %v", err)
		}
	}()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Errorf("error reading data: %v", err)
		return err
	}
	//remove unencoded &'s from xml
	replacer := strings.NewReplacer("&", "&amp;")
	xmlBody := replacer.Replace(string(body))
	var feed Feed
	err = xml.Unmarshal([]byte(xmlBody), &feed)
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
			err = ks.UpdateOrInsertLibrary(ctx, db, entry, ks.OpenContentProviderId)
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

func (ks *KiwixService) UpdateOrInsertLibrary(ctx context.Context, db *gorm.DB, entry Entry, providerId uint) error {
	log.Infof("Attempting to insert or update library from Kiwix: %v", entry.Title)
	library := ks.IntoLibrary(entry, providerId)
	if err := db.WithContext(ctx).
		Where(&Library{ExternalID: stringPtr(entry.ID)}).
		Assign(Library{
			Url:          library.Url,
			Title:        library.Title,
			Description:  library.Description,
			Language:     library.Language,
			ThumbnailUrl: library.ThumbnailUrl,
		}).
		FirstOrCreate(&library).Error; err != nil {
		log.Errorln("Error updating or inserting library: ", err)
		return err
	}
	return nil
}

func RemoveDeletedEntries(ctx context.Context, db *gorm.DB, externalIds []string, providerId uint) (int64, error) {
	log.Infoln("Removing any deleted Kiwix libraries")
	tx := db.WithContext(ctx).Where("open_content_provider_id = ?", providerId).Delete(&Library{}, "external_id NOT IN (?)", externalIds)
	if tx.Error != nil {
		return 0, tx.Error
	}

	return tx.RowsAffected, nil
}
