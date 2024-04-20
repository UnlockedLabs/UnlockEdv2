package main

import (
	"errors"
	"strings"
)

type KolibriResponse[T any] struct {
	Page       int `json:"page"`
	Count      int `json:"count"`
	TotalPages int `json:"total_pages"`
	Results    []T `json:"results"`
}

type KolibriUser struct {
	Id          string `json:"id"`
	Username    string `json:"username"`
	Fullname    string `json:"full_name"`
	Facility    string `json:"facility"`
	IdNumber    string `json:"id_number"`
	Gender      string `json:"gender"`
	BirthYear   string `json:"birth_year"`
	IsSuperuser bool   `json:"is_superuser"`
	Roles       []Role `json:"roles"`
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

type Role struct {
	Collection string `json:"collection"`
	Kind       string `json:"kind"`
	Id         string `json:"id"`
}
type KolibriClass struct {
	Id           string   `json:"id"`
	Name         string   `json:"name"`
	Parent       string   `json:"parent"`
	LearnerCount int      `json:"learner_count"`
	Coaches      []string `json:"coaches"`
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
