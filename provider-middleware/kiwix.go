package main

import (
	"encoding/xml"
	"io"
	"net/http"

	log "github.com/sirupsen/logrus"

	"gorm.io/gorm"
)

type KiwixService struct {
	Url string
}

func NewKiwixService() *KiwixService {
	return &KiwixService{
		Url: "https://library.kiwix.org/catalog/v2/entries?lang=eng&start=1&count=1000",
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
	log.Printf("Imported %v libraries", len(feed.Entries))
	return nil
}
