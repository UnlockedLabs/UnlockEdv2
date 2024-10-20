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
	Password    string `json:"password"`
}

func (ku *KolibriUser) IntoImportUser() (*models.ImportUser, error) {
	var first, last string

	splitName := strings.Split(ku.Fullname, " ")
	if len(splitName) > 1 {
		first = strings.Split(ku.Fullname, " ")[0]
		last = strings.Split(ku.Fullname, " ")[1]
	} else if len(splitName) > 2 {
		last = strings.Join(strings.Split(ku.Fullname, " ")[1:], " ")
	} else {
		first = ku.Fullname
		last = ku.Username
	}
	email := ku.Username + "@unlocked.v2"
	if first == "" && last == "" && ku.Username == "" {
		return nil, errors.New("invalid user")
	}
	user := models.ImportUser{
		Username:         ku.Username,
		NameFirst:        first,
		NameLast:         last,
		Email:            email,
		ExternalUserID:   ku.Id,
		ExternalUsername: ku.Username,
	}
	log.Printf("user to return: %v", user)
	return &user, nil
}

type KolibriContent struct {
	Author             string `json:"author"`
	Description        string `json:"description"`
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Root               string `json:"root_id"`
	Thumbnail          string `json:"thumbnail"`
	Version            int    `json:"version"`
	Public             bool   `json:"public"`
	TotalResourceCount int    `json:"total_resource_count"`
}

func (kc *KolibriService) IntoCourse(data map[string]interface{}) *models.Course {
	courseType := data["course_type"].(string)
	thumbnail := data["thumbnail"].(string)
	root := data["root_id"].(string)
	id := data["id"].(string)
	name := data["name"].(string)
	description := data["description"].(string)
	if len(description) > 255 {
		description = description[:255]
	}
	totalResourceCount := data["total_resource_count"].(int64)
	course := models.Course{
		ProviderPlatformID:      kc.ProviderPlatformID,
		ExternalID:              id,
		Name:                    name,
		Type:                    "open_content",
		OutcomeTypes:            "completion",
		TotalProgressMilestones: uint(totalResourceCount),
	}

	if courseType == "channel" {
		url, err := UploadImage(thumbnail, root, id)
		if err != nil {
			log.Printf("Failed to upload image %v", err)
			url = ""
		}
		course.Description = description
		course.ThumbnailURL = url
		course.ExternalURL = kc.BaseURL + "en/learn/#/topics/t/" + id + "/folders?last=HOME"
	} else {
		course.Description = "Kolibri managed course"
		course.ExternalURL = kc.BaseURL + "en/learn/#/home/classes/" + id
	}
	return &course
}

func decodeImg(thumbnail string) []byte {
	if strings.Contains(thumbnail, "data:image/png;base64") {
		img := strings.Split(thumbnail, ",")[1]
		imgDec, _ := base64.StdEncoding.DecodeString(img)
		return imgDec
	}
	return nil
}

func UploadImage(thumbnail, root, id string) (string, error) {
	log.Println("Uploading image")
	imgData := decodeImg(thumbnail)
	if imgData == nil {
		return "", errors.New("no image data available or decoding failed")
	}
	filename := "image_" + root + "/" + id + ".png"
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
