package main

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/sirupsen/logrus"
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
	Rel  string `xml:"rel,attr"`
	Href string `xml:"href,attr"`
	Type string `xml:"type,attr"`
}

func (ks *KiwixService) IntoLibrary(entry Entry, providerId uint) *models.Library {
	url, thumbnailURL := ks.ParseUrls(entry.Title, entry.Links)
	return &models.Library{
		OpenContentProviderID: providerId,
		ExternalID:            models.StringPtr(entry.ID),
		Name:                  entry.Title,
		Language:              models.StringPtr(entry.Language),
		Description:           models.StringPtr(entry.Summary),
		Path:                  url,
		ImageUrl:              models.StringPtr(thumbnailURL),
		VisibilityStatus:      false,
	}
}

func (ks *KiwixService) downloadAndHostThumbnailImg(lib, thumbnail string) (string, error) {
	imgUrl, err := url.JoinPath(ks.BaseUrl, thumbnail)
	if err != nil {
		logrus.Errorf("error joining URL: %v", err)
		return "", err
	}
	parsedURL, err := url.Parse(imgUrl)
	if err != nil {
		logrus.Errorf("error parsing imgUrl: %v", err)
		return "", err
	}
	query := parsedURL.Query()
	query.Set("size", "48")
	parsedURL.RawQuery = query.Encode()

	finalURL := parsedURL.String()
	logrus.Infof("downloading thumbnail image from URL: %s", finalURL)

	req, err := http.NewRequest(http.MethodGet, finalURL, nil)
	if err != nil {
		logrus.Errorf("error creating request: %v", err)
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "image/*")

	resp, err := ks.Client.Do(req)
	if err != nil {
		logrus.Errorf("error fetching thumbnail image from URL: %v", err)
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logrus.Errorf("failed to fetch thumbnail image: received %v response", resp.Status)
		return "", fmt.Errorf("failed to fetch thumbnail image: %v", resp.Status)
	}

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		logrus.Errorf("error reading thumbnail image: %v", err)
		return "", err
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	filename := lib + ".png"

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	_, err = part.Write(imgData)
	if err != nil {
		return "", err
	}
	fields := map[string]string{"filename": filename, "size": fmt.Sprintf("%d", len(imgData)), "type": "image/png"}
	for key, value := range fields {
		err = writer.WriteField(key, value)
		if err != nil {
			return "", err
		}
	}

	err = writer.Close()
	if err != nil {
		logrus.Errorf("error closing writer: %v", err)
		return "", err
	}

	uploadURL := os.Getenv("APP_URL") + "/upload"
	req, err = http.NewRequest(http.MethodPost, uploadURL, body)
	if err != nil {
		logrus.Errorf("error creating upload request: %v", err)
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := ks.Client.Do(req)
	if err != nil {
		logrus.Errorf("error sending upload request: %v", err)
		return "", err
	}
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		logrus.Errorf("failed to upload image: received %v response", uploadResp.Status)
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
		logrus.Errorf("error decoding upload response: %v", err)
		return "", err
	}

	return urlRes.Data.URL, nil
}

func (ks *KiwixService) ParseUrls(externId string, links []Link) (string, string) {
	var url string
	var thumbnailURL string
	for _, link := range links {
		if link.Type == "text/html" {
			url = link.Href
		}
		if strings.Split(link.Type, "/")[0] == "image" {
			if thumbnail, err := ks.downloadAndHostThumbnailImg(externId, link.Href); err == nil {
				thumbnailURL = thumbnail
			}
		}
	}
	logrus.Infof("URL: %s, ThumbnailURL: %s", url, thumbnailURL)
	return url, thumbnailURL
}
