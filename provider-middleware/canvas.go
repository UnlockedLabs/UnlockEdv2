package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
		ProviderPlatformID: provider.ID,
		Client:             &http.Client{},
		BaseURL:            provider.BaseUrl,
		Token:              provider.ApiKey,
		AccountID:          provider.AccountID,
		BaseHeaders:        &headers,
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
	log.Printf("url: %v", url)
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
		name := strings.Split(user["name"].(string), " ")
		nameFirst, nameLast := "", ""
		shortName := user["short_name"].(string)
		if len(name) < 2 && !strings.Contains(shortName, "@") {
			nameFirst = name[0]
			nameLast = shortName
		} else {
			nameFirst = name[0]
			nameLast = name[1]
		}
		userId, _ := user["id"].(float64)
		unlockedUser := UnlockEdImportUser{
			ExternalUserID:   fmt.Sprintf("%d", int(userId)),
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
		log.Printf("Failed to decode response: %v", err)
		return nil, err
	}
	unlockedCourses := make([]UnlockEdImportProgram, 0)
	for _, course := range courses {
		id := int(course["id"].(float64))
		totalMilestones := 0
		assignments, err := srv.getAssignmentsForCourse(id)
		if err != nil {
			log.Printf("Failed to get assignments for course: %v", err)
		} else {
			log.Printf("total assignments: %d", len(assignments))
			totalMilestones += len(assignments)
		}
		quizzes, err := srv.getQuizzesForCourse(id)
		if err != nil {
			log.Printf("Failed to get quizzes for course: %v", err)
		} else {
			log.Printf("total quizzes: %d", len(quizzes))
			totalMilestones += len(quizzes)
		}
		thumbnailURL := ""
		if course["image_download_url"] != nil {
			thumbnailURL = course["image_download_url"].(string)
		}
		description := ""
		if course["public_description"] != nil {
			description = course["public_description"].(string)
		} else {
			description = course["course_code"].(string)
		}
		progType := "fixed_enrollment"
		is_pub := course["is_public"].(bool)
		if is_pub {
			progType = "open_enrollment"
		} else {
			progType = "fixed_enrollment"
		}
		unlockedCourse := UnlockEdImportProgram{
			ProviderPlatformID:      srv.ProviderPlatformID,
			Name:                    course["name"].(string),
			AltName:                 course["course_code"].(string),
			ExternalID:              fmt.Sprintf("%d", id),
			ExternalURL:             srv.BaseURL + "/courses/" + fmt.Sprintf("%d", id),
			Type:                    progType,
			OutcomeTypes:            []string{"grade", "college_credit"},
			Description:             description,
			ThumbnailURL:            thumbnailURL,
			TotalProgressMilestones: totalMilestones,
		}
		unlockedCourses = append(unlockedCourses, unlockedCourse)
	}
	log.Printf("returning Unlocked programs")
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

func (srv *CanvasService) getAssignmentsForCourse(courseId int) ([]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/assignments"
	log.Printf("url: %v", url)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	assignments := []interface{}{}
	err = json.NewDecoder(resp.Body).Decode(&assignments)
	if err != nil {
		log.Printf("failed to decode response from assignments %v", err)
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
	submissions := make(map[string]interface{})
	err = json.NewDecoder(resp.Body).Decode(&submissions)
	if err != nil {
		return nil, err
	}
	if submissions == nil {
		return nil, fmt.Errorf("submission not found")
	}
	return submissions, nil
}

func (srv *CanvasService) getUserSubmissionsForCourse(userId, courseId int) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/students/submissions?student_ids[]=" + fmt.Sprintf("%d", userId)
	log.Printf("url: %v", url)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	submission := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&submission)
	if err != nil {
		return nil, err
	}
	if submission == nil {
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
func (srv *CanvasService) GetMilestonesForProgramUser(userId, courseId string) ([]UnlockEdImportMilestone, error) {
	userID, err := strconv.Atoi(userId)
	if err != nil {
		return nil, err
	}
	courseID, err := strconv.Atoi(courseId)
	if err != nil {
		return nil, err
	}
	submissions, err := srv.getUserSubmissionsForCourse(userID, courseID)
	if err != nil {
		log.Printf("Failed to get submission for assignment: %v", err)
		return nil, err
	}
	milestones := make([]UnlockEdImportMilestone, 0)
	for _, submission := range submissions {
		milestone := UnlockEdImportMilestone{
			ExternalID:        fmt.Sprintf("%d", int(submission["id"].(float64))),
			ExternalProgramID: courseId,
			Type:              "assignment_submission",
			IsCompleted:       submission["workflow_state"] == "complete" || submission["workflow_state"] == "graded",
		}
		milestones = append(milestones, milestone)
	}
	quizzes, err := srv.getQuizzesForCourse(courseID)
	if err != nil {
		// just return what we have
		return milestones, nil
	}
	for _, quiz := range quizzes {
		// go through each quiz and see if we have a submission from the user
		quizId := int(quiz["id"].(float64))
		if submission, err := srv.getUserSubmissionForQuiz(courseID, quizId, userID); err == nil {
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
				UserID:            userID,
				ExternalProgramID: courseId,
				Type:              milestoneType,
			}
			milestones = append(milestones, milestone)
		}
	}
	return milestones, nil
}

func (srv *CanvasService) getEnrollmentsForCourse(courseId string) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/enrollments?state[]=active&state[]=invited&type[]=StudentEnrollment"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	enrollments := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&enrollments)
	if err != nil {
		return nil, err
	}
	return enrollments, nil
}

func (srv *CanvasService) GetActivityForProgram(courseId string) ([]UnlockEdImportActivity, error) {
	enrollments, err := srv.getEnrollmentsForCourse(courseId)
	if err != nil {
		log.Printf("Failed to get enrollments for course: %v", err)
		return nil, err
	}
	activities := make([]UnlockEdImportActivity, 0)
	for _, enrollment := range enrollments {
		userId := fmt.Sprintf("%d", int(enrollment["user_id"].(float64)))
		activity := UnlockEdImportActivity{
			ExternalProgramID: courseId,
			ExternalUserID:    userId,
			Type:              "interaction",
			TotalTime:         int(enrollment["total_activity_time"].(float64)),
			Date:              time.Now().Format("2006-01-02"),
			ExternalContentID: fmt.Sprintf("%d", int(enrollment["id"].(float64))),
		}
		activities = append(activities, activity)
	}
	return activities, nil
}
