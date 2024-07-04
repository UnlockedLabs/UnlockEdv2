package main

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
)

type KolibriResponse[T any] struct {
	Results    []T `json:"results"`
	Page       int `json:"page"`
	Count      int `json:"count"`
	TotalPages int `json:"total_pages"`
}

func (srv *ServiceHandler) LookupProvider(id int) (*models.ProviderPlatform, error) {
	var provider models.ProviderPlatform
	err := srv.db.Where("id = ?", id).First(&provider).Error
	if err != nil {
		log.Println("Failed to find provider")
		return nil, err
	}
	key, err := provider.DecryptAccessKey()
	if err != nil {
		log.Println("Failed to decrypt access key")
		return nil, err
	}
	provider.AccessKey = key
	return &provider, nil
}

type KolibriUser struct {
	Roles       []Role `json:"roles"`
	Id          string `json:"id"`
	Username    string `json:"username"`
	Fullname    string `json:"full_name"`
	Facility    string `json:"facility"`
	IdNumber    string `json:"id_number"`
	Gender      string `json:"gender"`
	BirthYear   string `json:"birth_year"`
	IsSuperuser bool   `json:"is_superuser"`
}

func (ku *KolibriUser) IntoImportUser() (*models.ImportUser, error) {
	first := strings.Split(ku.Fullname, " ")[0]
	last := strings.Split(ku.Fullname, " ")[1]
	if len(strings.Split(ku.Fullname, " ")) > 2 {
		last = strings.Join(strings.Split(ku.Fullname, " ")[1:], " ")
	}
	email := ku.Username + "@unlocked.v2"
	if first == "" && last == "" && ku.Username == "" {
		return nil, errors.New("invalid user")
	}
	return &models.ImportUser{
		Username:         ku.Username,
		NameFirst:        first,
		Email:            email,
		NameLast:         last,
		ExternalUserID:   ku.Id,
		ExternalUsername: ku.Username,
	}, nil
}

type KolibriContent struct {
	Author             string      `json:"author"`
	Description        string      `json:"description"`
	Tagline            interface{} `json:"tagline"`
	ID                 string      `json:"id"`
	LastUpdated        string      `json:"last_updated"`
	Name               string      `json:"name"`
	Root               string      `json:"root"`
	Thumbnail          string      `json:"thumbnail"`
	Version            int         `json:"version"`
	Public             bool        `json:"public"`
	TotalResourceCount int         `json:"total_resource_count"`
	PublishedSize      int         `json:"published_size"`
	NumCoachContents   int         `json:"num_coach_contents"`
	Available          bool        `json:"available"`
	LangCode           string      `json:"lang_code"`
	LangName           string      `json:"lang_name"`
	IncludedLanguages  []string    `json:"included_languages"`
	LastPublished      string      `json:"last_published"`
}

func (kc *KolibriContent) IntoCourse(provUrl string) *models.Program {
	url, err := kc.UploadImage()
	if err != nil {
		log.Printf("Failed to upload image %v", err)
		url = ""
	}
	return &models.Program{
		ExternalID:              kc.ID,
		Name:                    kc.Name,
		Description:             kc.Description,
		ThumbnailURL:            url,
		Type:                    "open_content",
		OutcomeTypes:            "completion",
		TotalProgressMilestones: uint(kc.TotalResourceCount),
		ExternalURL:             provUrl + "/channels/" + kc.Root,
	}
}

func (kc *KolibriContent) DecodeImg() []byte {
	if strings.Contains(kc.Thumbnail, "data:image/png;base64") {
		img := strings.Split(kc.Thumbnail, ",")[1]
		imgDec, _ := base64.StdEncoding.DecodeString(img)
		return imgDec
	}
	return nil
}

func (kc *KolibriContent) UploadImage() (string, error) {
	log.Println("Uploading image")
	imgData := kc.DecodeImg()
	if imgData == nil {
		return "", errors.New("no image data available or decoding failed")
	}
	filename := "image_" + kc.Root + "/" + kc.ID + ".png"
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err = part.Write(imgData); err != nil {
		return "", err
	}
	err = writer.Close()
	if err != nil {
		return "", err
	}
	request, err := http.NewRequest("POST", os.Getenv("APP_URL")+"/upload", body)
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Content-Length", fmt.Sprintf("%d", len(body.Bytes())))
	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("server returned non-OK status: %s", response.Status)
	}
	var result map[string]string
	err = json.NewDecoder(response.Body).Decode(&result)
	if err != nil {
		return "", err
	}
	url, ok := result["url"]
	if !ok {
		return "", errors.New("response does not contain URL")
	}
	return url, nil
}

type Role struct {
	Collection string `json:"collection"`
	Kind       string `json:"kind"`
	Id         string `json:"id"`
}
