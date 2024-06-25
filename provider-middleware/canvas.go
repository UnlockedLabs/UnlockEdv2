package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type CanvasService struct {
	ProviderPlatformID uint
	Client             *http.Client
	BaseURL            string
	Token              string
	AccountID          string
	BaseHeaders        *map[string]string
	ClientID           string
	RedirectURI        string
}

func newCanvasService(provider *models.ProviderPlatform) *CanvasService {
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + provider.AccessKey
	headers["Accept"] = "application/json"
	return &CanvasService{
		ProviderPlatformID: provider.ID,
		Client:             &http.Client{},
		BaseURL:            provider.BaseUrl,
		Token:              provider.AccessKey,
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
			nameFirst = strings.Split(shortName, "@")[0]
			nameLast = shortName
		} else if len(name) > 2 {
			nameFirst = name[0]
			nameLast = name[1]
		} else {
			nameFirst = name[0]
			nameLast = shortName
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

func (srv *CanvasService) ImportPrograms(db *gorm.DB) error {
	url := srv.BaseURL + "/api/v1/accounts/" + srv.AccountID + "/courses?include[]=course_image&include[]=public_description"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return err
	}
	defer resp.Body.Close()
	courses := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&courses)
	if err != nil {
		log.Printf("Failed to decode response: %v", err)
		return err
	}
	for _, course := range courses {
		id := int(course["id"].(float64))
		var hasProgram models.Program
		err = db.Table("programs").Select("external_id").Where("provider_platform_id = ? AND external_id = ?", srv.ProviderPlatformID, id).First(&hasProgram).Error
		if err == nil {
			// dont import same program twice
			continue
		}
		totalMilestones := 0
		assignments, err := srv.getAssignmentsForCourse(id)
		if err != nil {
			log.Printf("Failed to get assignments for course: %v", err)
		} else {
			log.Printf("total assignments: %d", len(assignments))
			totalMilestones += len(assignments)
		}
		quizzes, err := srv.getQuizzesForCourse(fmt.Sprintf("%d", id))
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
		unlockedCourse := models.Program{
			ProviderPlatformID:      srv.ProviderPlatformID,
			Name:                    course["name"].(string),
			AltName:                 course["course_code"].(string),
			ExternalID:              fmt.Sprintf("%d", id),
			ExternalURL:             srv.BaseURL + "/courses/" + fmt.Sprintf("%d", id),
			Type:                    models.ProgramType(progType),
			OutcomeTypes:            "grade, college_credit",
			Description:             description,
			ThumbnailURL:            thumbnailURL,
			TotalProgressMilestones: uint(totalMilestones),
		}
		if err = db.Create(&unlockedCourse).Error; err != nil {
			log.Printf("Failed to create program: %v", err)
			continue
		}
	}
	return nil
}

func (srv *CanvasService) getQuizzesForCourse(externalCourseId string) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + externalCourseId + "/quizzes"
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

// external ID
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

// all external ids
func (srv *CanvasService) getUserSubmissionForQuiz(courseId, quizId, userId string) (map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/quizzes/" + quizId + "/submissions/" + userId
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

func (srv *CanvasService) getUserSubmissionsForCourse(userId, courseId string) ([]map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/students/submissions?student_ids[]=" + userId
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
func (srv *CanvasService) ImportMilestonesForProgramUser(userId, courseId string, db *gorm.DB) error {
	var mapping models.ProviderUserMapping
	err := db.Table("provider_user_mappings").Select("provider_user_mappings.user_id").Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id = ?)", srv.ProviderPlatformID, userId).First(&mapping).Error
	if err != nil {
		log.Errorln("failed to get user with id in GetMilestonesForProgramUser: ", userId)
		return err
	}
	userID := mapping.ExternalUserID
	var program models.Program
	err = db.Table("programs").Select("external_id").Where("id = ?", courseId).First(&program).Error
	if err != nil {
		log.Errorln("failed to get program with id in GetMilestonesForProgramUser: ", courseId)
		return err
	}
	courseID := program.ExternalID
	submissions, err := srv.getUserSubmissionsForCourse(userID, courseID)
	if err != nil {
		log.Printf("Failed to get submission for assignment: %v", err)
		return err
	}
	userIdInt, err := strconv.Atoi(userId)
	if err != nil {
		log.Errorln("failed to convert userId to int in GetMilestonesForProgramUser: ", userId)
		return err
	}
	courseIdInt, err := strconv.Atoi(courseId)
	if err != nil {
		log.Errorln("failed to convert courseId to int in GetMilestonesForProgramUser: ", courseId)
		return err
	}
	for _, submission := range submissions {
		milestone := models.Milestone{
			UserID:      uint(userIdInt),
			ExternalID:  fmt.Sprintf("%d", int(submission["id"].(float64))),
			ProgramID:   uint(courseIdInt),
			Type:        "assignment_submission",
			IsCompleted: submission["workflow_state"] == "complete" || submission["workflow_state"] == "graded",
		}
		err = db.Create(&milestone).Error
		if err != nil {
			log.Errorln("failed to create milestone in GetMilestonesForProgramUser: ", err)
			continue
		}
	}
	quizzes, err := srv.getQuizzesForCourse(courseID)
	if err != nil {
		// just return what we have
		return nil
	}
	for _, quiz := range quizzes {
		// go through each quiz and see if we have a submission from the user
		quizId := int(quiz["id"].(float64))
		if submission, err := srv.getUserSubmissionForQuiz(courseID, fmt.Sprintf("%d", quizId), userID); err == nil {
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
			milestone := models.Milestone{
				ExternalID: submission["id"].(string),
				UserID:     uint(userIdInt),
				ProgramID:  uint(courseIdInt),
				Type:       models.MilestoneType(milestoneType),
			}
			err := db.Create(&milestone).Error
			if err != nil {
				log.Errorln("failed to create milestone in GetMilestonesForProgramUser: ", err)
				continue
			}
		}
	}
	return nil
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

func (srv *CanvasService) ImportActivityForProgram(courseId string, db *gorm.DB) error {
	enrollments, err := srv.getEnrollmentsForCourse(courseId)
	if err != nil {
		log.Printf("Failed to get enrollments for course: %v", err)
		return err
	}
	for _, enrollment := range enrollments {
		userId := fmt.Sprintf("%d", int(enrollment["user_id"].(float64)))
		var user models.User
		err := db.Table("users").Select("users.id").Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id = ?)", srv.ProviderPlatformID, userId).
			Joins("JOIN provider_user_mappings ON users.id = provider_user_mappings.user_id").First(&user).Error
		if err != nil {
			log.Printf("Failed to get user: %v", err)
			continue
		}
		var program models.Program
		if err = db.Table("programs").Select("id").Where("provider_platform_id = ? AND external_id = ?", srv.ProviderPlatformID, courseId).First(&program).Error; err != nil {
			log.Printf("Failed to get program: %v", err)
			continue
		}
		activity := models.Activity{
			ExternalID: courseId,
			UserID:     user.ID,
			Type:       "interaction",
			TotalTime:  uint(enrollment["total_activity_time"].(float64)),
			ProgramID:  program.ID,
		}
		if err = db.Create(&activity).Error; err != nil {
			log.Printf("Failed to create activity: %v", err)
			continue
		}
	}
	return nil
}
