package main

import (
	"bytes"
	"database/sql"
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

type ProviderPlatform struct {
	ID        int    `json:"id"`
	Type      string `json:"type"`
	AccountID string `json:"account_id"`
	Url       string `json:"url"`
	ApiKey    string `json:"api_key"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func (prov *ProviderPlatform) SaveProvider(db *sql.DB) error {
	log.Printf("Saving provider: %v", prov)
	stmt, err := db.Prepare("INSERT INTO providers (id, type, account_id, url, api_key, username, password) VALUES ($1, $2, $3, $4, $5, $6, $7)")
	if err != nil {
		log.Println("Failed to prepare statement")
		return err
	}
	_, err = stmt.Exec(prov.ID, prov.Type, prov.AccountID, prov.Url, prov.ApiKey, prov.Username, prov.Password)
	if err != nil {
		log.Println("Failed to execute statement")
		return err
	}
	log.Println("Provider created successfully")
	return nil
}

func (srv *ServiceHandler) LookupProvider(id int) (*ProviderPlatform, error) {
	var provider ProviderPlatform
	log.Println("Looking up provider #", id)
	err := srv.db.QueryRow("SELECT * FROM providers WHERE id = $1", id).Scan(&provider.ID, &provider.Type, &provider.AccountID, &provider.Url, &provider.ApiKey, &provider.Username, &provider.Password)
	if err != nil {
		log.Println("Failed to find provider")
		return nil, err
	}
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

func (ku *KolibriUser) IntoImportUser() (*UnlockEdImportUser, error) {
	first := strings.Split(ku.Fullname, " ")[0]
	last := strings.Split(ku.Fullname, " ")[1]
	if len(strings.Split(ku.Fullname, " ")) > 2 {
		last = strings.Join(strings.Split(ku.Fullname, " ")[1:], " ")
	}
	email := ku.Username + "@unlocked.v2"
	if first == "" && last == "" && ku.Username == "" {
		return nil, errors.New("invalid user")
	}
	return &UnlockEdImportUser{
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

func (kc *KolibriContent) IntoCourse(provUrl string) *UnlockEdImportProgram {
	url, err := kc.UploadImage()
	if err != nil {
		log.Printf("Failed to upload image %v", err)
		url = ""
	}
	return &UnlockEdImportProgram{
		ExternalID:   kc.ID,
		Name:         kc.Name,
		Description:  kc.Description,
		ThumbnailURL: url,
		IsPublic:     kc.Public,
		ExternalURL:  provUrl + "/channels/" + kc.Root,
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
type UnlockEdImportUser struct {
	Username         string `json:"username"`
	NameFirst        string `json:"name_first"`
	NameLast         string `json:"name_last"`
	Email            string `json:"email"`
	ExternalUserID   string `json:"external_user_id"`
	ExternalUsername string `json:"external_username"`
}
type UnlockEdImportProgram struct {
	ProviderPlatformID      int    `json:"provider_platform_id"`
	Name                    string `json:"name"`
	Description             string `json:"description"`
	ExternalID              string `json:"external_id"`
	ThumbnailURL            string `json:"thumbnail_url"`
	IsPublic                bool   `json:"is_public"`
	ExternalURL             string `json:"external_url"`
	TotalProgressMilestones int    `json:"total_progress_milestones"`
}

type UnlockEdImportMilestone struct {
	UserID            int    `json:"user_id"`
	ExternalProgramID string `json:"external_program_id"`
	ExternalID        string `json:"external_id"`
	Type              string `json:"type"`
	IsCompleted       bool   `json:"is_completed"`
}
