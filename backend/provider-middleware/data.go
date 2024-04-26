package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"
)

type KolibriResponse[T any] struct {
	Results    []T `json:"results"`
	Page       int `json:"page"`
	Count      int `json:"count"`
	TotalPages int `json:"total_pages"`
}

type ProviderPlatform struct {
	FacilityID string `json:"facility_id"`
	Url        string `json:"url"`
	ApiKey     string `json:"api_key"`
	Username   string `json:"username"`
	Password   string `json:"password"`
}

func NewProviderFromForm(request *http.Request) (ProviderPlatform, error) {
	err := request.ParseForm()
	if err != nil {
		return ProviderPlatform{}, err
	}
	return ProviderPlatform{
		FacilityID: request.PostForm.Get("facility_id"),
		Url:        request.PostForm.Get("url"),
		ApiKey:     request.PostForm.Get("api_key"),
		Username:   request.PostForm.Get("username"),
		Password:   request.PostForm.Get("password"),
	}, nil
}

func (prov *ProviderPlatform) SaveProvider(db *sql.DB) error {
	stmt, err := db.Prepare("INSERT INTO providers (facility_id, url, api_key, username, password) VALUES ($1, $2, $3, $4, $5)")
	if err != nil {
		return err
	}
	_, err = stmt.Exec(prov.FacilityID, prov.Url, prov.ApiKey, prov.Username, prov.Password)
	if err != nil {
		return err
	}
	log.Println("Provider created successfully")
	return nil
}

func (srv *ServiceHandler) LookupProvider(facilityId string) (ProviderPlatform, error) {
	var provider ProviderPlatform
	err := srv.db.QueryRow("SELECT * FROM providers WHERE facility_id = $1", facilityId).Scan(&provider.FacilityID, &provider.Url, &provider.ApiKey, &provider.Username, &provider.Password)
	if err != nil {
		return ProviderPlatform{}, err
	}
	return provider, nil
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

func (ku KolibriUser) IntoImportUser() (UnlockEdImportUser, error) {
	first := strings.Split(ku.Fullname, " ")[0]
	last := strings.Split(ku.Fullname, " ")[1]
	if len(strings.Split(ku.Fullname, " ")) > 2 {
		last = strings.Join(strings.Split(ku.Fullname, " ")[1:], " ")
	}
	if first == "" && last == "" && ku.Username == "" {
		return UnlockEdImportUser{}, errors.New("invalid user")
	}
	return UnlockEdImportUser{
		Username:         ku.Username,
		NameFirst:        first,
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

/**
* @param id - KOLIBRI_FACILITY_ID
* @return UnlockEdCourse
**/
func (kc KolibriContent) IntoCourse(id string) UnlockEdCourse {
	return UnlockEdCourse{
		ExternalResourceID: kc.ID,
		ExternalCourseCode: kc.Root,
		Description:        kc.Description,
		ProviderPlatformID: id,
		ExternalCourseName: kc.Name,
		ImgURL:             kc.Thumbnail,
	}
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
	ExternalUserID   string `json:"external_user_id"`
	ExternalUsername string `json:"external_username"`
}

type UnlockEdCourse struct {
	ExternalResourceID string `json:"external_resource_id"`
	ExternalCourseCode string `json:"external_course_code"`
	Description        string `json:"description"`
	ProviderPlatformID string `json:"provider_platform_id"`
	ExternalCourseName string `json:"external_course_name"`
	ImgURL             string `json:"img_url"`
}

type UnlockEdEnrollment struct {
	UserID               string `json:"user_id"`
	CourseID             string `json:"course_id"`
	ExternalEnrollmentID string `json:"external_enrollment_id"`
	EnrollmentState      string `json:"enrollment_state"`
	ExternalStartAt      string `json:"external_start_at"`
	ExternalEndAt        string `json:"external_end_at"`
	ExternalLinkURL      string `json:"external_link_url"`
}
