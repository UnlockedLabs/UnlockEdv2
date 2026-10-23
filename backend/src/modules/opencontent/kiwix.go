package opencontent

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"

	log "github.com/sirupsen/logrus"
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
	store                 *store
}

func NewKiwixService(openContentProvider *OpenContentProvider, store *store, params map[string]any) *KiwixService {
	url := fmt.Sprintf("%s%s%d", openContentProvider.Url, KiwixCatalogUrl, maxLibraries)
	client := http.Client{}
	return &KiwixService{
		OpenContentProviderId: openContentProvider.ID,
		BaseUrl:               openContentProvider.Url,
		Url:                   url,
		params:                params,
		Client:                &client,
		store:                 store,
	}
}

func (ks *KiwixService) ImportLibraries(ctx context.Context) error {
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
			err = ks.UpdateOrInsertLibrary(ctx, entry, ks.OpenContentProviderId)
			if err != nil {
				log.Errorf("error updating or inserting library: %v", err)
				return err
			}
		}
	}
	log.Infoln("Removing any deleted Kiwix libraries")
	removed, err := ks.store.DeleteLibrariesNotIn(ctx, ks.OpenContentProviderId, externalIds)
	if err != nil {
		log.Errorf("error removing deleted entries: %v", err)
		return err
	}
	log.Infof("Removed %v deleted libraries", removed)
	return nil
}

func (ks *KiwixService) UpdateOrInsertLibrary(ctx context.Context, entry Entry, providerId uint) error {
	log.Infof("Attempting to insert or update library from Kiwix: %v", entry.Title)
	library := ks.IntoLibrary(entry, providerId)
	if err := ks.store.UpsertLibrary(ctx, library); err != nil {
		log.Errorln("Error updating or inserting library: ", err)
		return err
	}
	return nil
}
