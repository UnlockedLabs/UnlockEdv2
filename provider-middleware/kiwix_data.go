package main

import (
	"UnlockEdv2/src/models"
	"encoding/xml"
	"strings"
)

type Feed struct {
	XMLName xml.Name `xml:"feed"`
	Entries []Entry  `xml:"entry"`
}

type Entry struct {
	ID           string    `xml:"id"`
	Title        string    `xml:"title"`
	Updated      string    `xml:"updated"`
	Summary      string    `xml:"summary"`
	Language     string    `xml:"language"`
	Name         string    `xml:"name"`
	Flavour      string    `xml:"flavour"`
	Category     string    `xml:"category"`
	Tags         string    `xml:"tags"`
	ArticleCount int       `xml:"articleCount"`
	MediaCount   int       `xml:"mediaCount"`
	Author       Author    `xml:"author"`
	Publisher    Publisher `xml:"publisher"`
	Links        []Link    `xml:"link"`
}

type Author struct {
	Name string `xml:"name"`
}

type Publisher struct {
	Name string `xml:"name"`
}

type Link struct {
	Rel  string `xml:"rel"`
	Href string `xml:"href"`
	Type string `xml:"type"`
}

func IntoLibrary(entry Entry) *models.Library {
	url, thumbnailURL := ParseUrls(entry.Links)
	return &models.Library{
		OpenContentProviderID: 0,
		ExternalID:            models.StringPtr(entry.ID),
		Name:                  entry.Title,
		Language:              models.StringPtr(entry.Language),
		Description:           models.StringPtr(entry.Summary),
		Url:                   url,
		ImageUrl:              models.StringPtr(thumbnailURL),
		VisibilityStatus:      false,
	}
}

func ParseUrls(links []Link) (string, string) {
	var url string
	var thumbnailURL string
	for _, link := range links {
		if link.Type == "text/html" {
			url = link.Href
		}
		if strings.Split(link.Type, "/")[0] == "image" {
			thumbnailURL = link.Href
		}
	}
	return url, thumbnailURL
}
