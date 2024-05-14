package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

type CanvasService struct {
	ProviderPlatformID int
	Client             *http.Client
	BaseURL            string
	Token              string
	AccountID          string
	BaseHeaders        *map[string]string
	ClientID           string
	RedirectURI        string
}

func newCanvasService(provider *ProviderPlatform) *CanvasService {
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + provider.ApiKey
	headers["Accept"] = "application/json"
	return &CanvasService{
		Client:      &http.Client{},
		BaseURL:     provider.Url,
		Token:       provider.ApiKey,
		AccountID:   provider.AccountID,
		BaseHeaders: &headers,
	}
}

func (srv *CanvasService) SendRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range *srv.BaseHeaders {
		req.Header.Add(key, value)
	}
	resp, err := srv.Client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (srv *CanvasService) GetID() int {
	return srv.ProviderPlatformID
}

func (srv *CanvasService) GetUsers() ([]UnlockEdImportUser, error) {
	url := srv.BaseURL + "/api/v1/accounts/" + srv.AccountID + "/users"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	users := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		return nil, err
	}
	log.Printf("Request sent to canvas Users: %v", users)
	unlockedUsers := make([]UnlockEdImportUser, 0)
	for _, user := range users {
		log.Printf("User: %v", user)
		name := strings.Split(user["name"].(string), " ")
		nameFirst, nameLast := "", ""
		if len(name) < 2 {
			nameFirst = name[0]
			nameLast = user["short_name"].(string)
		} else {
			nameFirst = name[0]
			nameLast = name[1]
		}
		userId, _ := user["id"].(int)
		unlockedUser := UnlockEdImportUser{
			ExternalUserID:   strconv.Itoa(userId),
			ExternalUsername: user["login_id"].(string),
			NameFirst:        nameFirst,
			NameLast:         nameLast,
			Email:            user["login_id"].(string),
			Username:         nameLast + nameFirst,
		}
		log.Printf("Unlocked User: %v", unlockedUser)
		unlockedUsers = append(unlockedUsers, unlockedUser)
	}
	log.Println("returning Unlocked Users")
	return unlockedUsers, nil
}

func (srv *CanvasService) GetPrograms() ([]UnlockEdImportProgram, error) {
	url := srv.BaseURL + "/api/v1/accounts/" + srv.AccountID + "/courses?include[]=course_image&include[]=public_description"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	courses := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&courses)
	if err != nil {
		return nil, err
	}
	unlockedCourses := make([]UnlockEdImportProgram, 0)
	for _, course := range courses {
		courseId, ok := course["id"].(int)
		if !ok {
			continue
		}
		assignments, err := srv.getAssignmentsForCourse(courseId)
		totalMilestones := 0
		if err != nil {
			log.Printf("Failed to get assignments for course: %v", err)
		} else {
			totalMilestones += len(assignments)
		}
		quizzes, err := srv.getQuizzesForCourse(courseId)
		if err != nil {
			log.Printf("Failed to get quizzes for course: %v", err)
		} else {
			totalMilestones += len(quizzes)
		}
		unlockedCourse := UnlockEdImportProgram{
			ProviderPlatformID:      srv.ProviderPlatformID,
			Name:                    course["name"].(string),
			ExternalID:              course["id"].(string),
			Description:             course["description"].(string),
			IsPublic:                course["is_public"].(bool),
			ThumbnailURL:            course["image_download_url"].(string),
			TotalProgressMilestones: totalMilestones,
		}
		unlockedCourses = append(unlockedCourses, unlockedCourse)
	}
	return unlockedCourses, nil
}

func (srv *CanvasService) getQuizzesForCourse(courseId int) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/quizzes"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	quizzes := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&quizzes)
	if err != nil {
		return nil, err
	}
	return quizzes, nil
}

func (srv *CanvasService) getAssignmentsForCourse(courseId int) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/assignments"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	assignments := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&assignments)
	if err != nil {
		return nil, err
	}
	return assignments, nil
}

func (srv *CanvasService) getUserSubmissionForQuiz(courseId, quizId, userId int) (map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/quizzes/" + fmt.Sprintf("%d", quizId) + "/submissions/" + fmt.Sprintf("%d", userId)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	submission := make(map[string]interface{})
	err = json.NewDecoder(resp.Body).Decode(&submission)
	if err != nil {
		return nil, err
	}
	if submission == nil || submission["id"] == nil {
		return nil, fmt.Errorf("submission not found")
	}
	return submission, nil
}

func (srv *CanvasService) getUserSubmissionsForAssignment(courseId, assignmentId, userId int) (map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/assignments/" + fmt.Sprintf("%d", assignmentId) + "/submissions/" + fmt.Sprintf("%d", userId)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	submission := make(map[string]interface{})
	err = json.NewDecoder(resp.Body).Decode(&submission)
	if err != nil {
		return nil, err
	}
	if submission == nil || submission["id"] == nil {
		return nil, fmt.Errorf("submission not found")
	}
	return submission, nil
}

/**
* First, we get all the assignments for the course
*  /api/v1/courses/:course_id/assignments
*
* Then we get the submissions for the assignment
*  /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id
*
* Then we get all the quizzes for the course
*  /api/v1/courses/98/quizzes
*
* get submissions for the user for each quiz
*  /api/v1/courses/:course_id/quizzes/:quiz_id/submissions/:user_id
* */
func (srv *CanvasService) GetMilestonesForProgramUser(courseId, userId int) ([]UnlockEdImportMilestone, error) {
	assignments, err := srv.getAssignmentsForCourse(courseId)
	if err != nil {
		return nil, err
	}
	if len(assignments) == 0 {
		return nil, fmt.Errorf("user is likely not enrolled or there are no assignments")
	}
	milestones := make([]UnlockEdImportMilestone, 0)
	for _, assignment := range assignments {
		if hasSubmissions, ok := assignment["has_submitted_submissions"].(bool); !ok || !hasSubmissions {
			// if there are no submissions, dont bother fetching them for the user
			continue
		}
		assignmentId := assignment["id"].(int)
		submission, err := srv.getUserSubmissionsForAssignment(courseId, assignmentId, userId)
		if err != nil {
			log.Printf("Failed to get submission for assignment: %v", err)
			return nil, err
		}
		milestone := UnlockEdImportMilestone{
			ExternalID:        submission["id"].(string),
			UserID:            userId,
			ExternalProgramID: fmt.Sprintf("%d", courseId),
			Type:              "assignment_submission",
		}
		milestones = append(milestones, milestone)
	}
	quizzes, err := srv.getQuizzesForCourse(courseId)
	if err != nil {
		// just return what we have
		return milestones, nil
	}
	for _, quiz := range quizzes {
		// go through each quiz and see if we have a submission from the user
		quizId, ok := quiz["id"].(int)
		if !ok {
			continue
		}
		if submission, err := srv.getUserSubmissionForQuiz(courseId, quizId, userId); err == nil {
			state, ok := submission["workflow_state"].(string)
			if !ok || state == "untaken" {
				continue
			}
			milestoneType := "quiz_assignment"
			if state == "complete" {
				milestoneType = "quiz_submission"
			}
			if state == "complete" {
				milestoneType = "quiz_completion"
			}
			milestone := UnlockEdImportMilestone{
				ExternalID:        submission["id"].(string),
				UserID:            userId,
				ExternalProgramID: fmt.Sprintf("%d", courseId),
				Type:              milestoneType,
			}
			milestones = append(milestones, milestone)
		}
	}
	return milestones, nil
}
