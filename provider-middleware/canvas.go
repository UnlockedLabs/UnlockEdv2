package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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
	JobParams          *map[string]interface{}
}

func newCanvasService(provider *models.ProviderPlatform, params *map[string]interface{}) *CanvasService {
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
		JobParams:          params,
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

func (cs *CanvasService) GetJobParams() *map[string]interface{} {
	return cs.JobParams
}

func (srv *CanvasService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	// TODO: handle sis, prefix, or something that accounts for sheer amt of users
	url := srv.BaseURL + "/api/v1/accounts/" + srv.AccountID + "/users?per_page=1000"
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
	unlockedUsers := make([]models.ImportUser, 0)
	for _, user := range users {
		name := strings.Split(user["name"].(string), " ")
		sortable := user["sortable_name"].(string)
		sortableName := strings.Split(sortable, ",")
		nameFirst, nameLast := "", ""
		if len(sortableName) > 1 {
			nameFirst = sortableName[1]
			nameLast = sortableName[0]
		} else if nameFirst == "" && len(name) > 1 {
			nameFirst = name[0]
			nameLast = name[1]
		} else {
			shortName := user["short_name"].(string)
			nameFirst = shortName
			nameLast = name[0]
		}
		userId, _ := user["id"].(float64)
		var count int64 = 0
		err := db.Model(&models.ProviderUserMapping{}).Where("external_user_id = ?", fmt.Sprintf("%d", int(userId))).Where("provider_platform_id = ?", srv.ProviderPlatformID).Count(&count).Error
		if err != nil {
			log.Errorf("Error counting provider_user_mappings: %v", err)
			continue
		}
		if count > 0 {
			log.Println("User found in provider_user_mappings, not returning user to client")
			continue
		}
		unlockedUser := models.ImportUser{
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
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportPrograms"}
	log.WithFields(fields).Info("importing programs from provider")
	defer resp.Body.Close()
	courses := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&courses)
	if err != nil {
		log.Printf("Failed to decode response: %v", err)
		return err
	}
	for _, course := range courses {
		id := int(course["id"].(float64))
		var count int64 = 0
		log.Infof("importing course %d", id)
		err := db.Table("programs").Where("provider_platform_id = ?", srv.ProviderPlatformID).Where("external_id = ?", fmt.Sprintf("%d", id)).Count(&count).Error
		if err != nil {
			log.Error("error getting count of provider courses")
			continue
		}
		if count > 0 {
			log.Debug("skipping course id: ", id)
			continue
		}
		totalMilestones := 0
		assignments, err := srv.getCountAssignmentsForCourse(id)
		if err != nil {
			log.Printf("Failed to get assignments for course: %v", err)
		} else {
			log.Printf("total assignments: %d", assignments)
			totalMilestones += assignments
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
		description := course["course_code"].(string)
		progType := "fixed_enrollment"
		is_pub, ok := course["is_public"].(bool)
		if !ok {
			is_pub = false
		}
		outcome_types := "grade"
		if is_pub {
			progType = "open_enrollment"
		} else {
			outcome_types += ", college_credit"
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

func getNodesLength(data map[string]interface{}) int {
	if courseData, ok := data["data"].(map[string]interface{}); ok {
		if course, ok := courseData["course"].(map[string]interface{}); ok {
			if assignmentsConnection, ok := course["assignmentsConnection"].(map[string]interface{}); ok {
				if nodes, ok := assignmentsConnection["nodes"].([]interface{}); ok {
					log.Traceln("got length of assignments for course")
					return len(nodes)
				}
			}
			log.Warnln("failed to decode 'assignmentsConnection' from getNodesLength")
		}
		log.Warnln("failed to decode 'course' from getNodesLength")
	}
	log.Warnln("failed to decode 'data' from getNodesLength")
	return 0
}

func (srv *CanvasService) getCountAssignmentsForCourse(courseId int) (int, error) {
	// graphQL query to canvas to get just the count
	query := fmt.Sprintf(`{
		"query": "query { course(id: \"%d\") { assignmentsConnection { nodes { _id } } } }"
	}`, courseId)
	url := srv.BaseURL + "/api/graphql"
	req, err := http.NewRequest("POST", url, strings.NewReader(query))
	if err != nil {
		log.Errorln("error creating graphql request for canvas")
		return 0, err
	}
	log.Debug("Getting count of assignments for course: ", courseId)
	for key, value := range *srv.BaseHeaders {
		req.Header.Add(key, value)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorln("error sending graphql request for canvas:", err)
		return 0, err
	}
	if resp.StatusCode != 200 {
		log.Errorln("response from canvas assignments for course failed with code: ", resp.Status)
		return 0, err
	}
	defer resp.Body.Close()
	assignments := make(map[string]interface{})
	err = json.NewDecoder(resp.Body).Decode(&assignments)
	if err != nil {
		log.Errorln("Error decoding json body from request: ", resp.Body)
		return 0, err
	}
	return getNodesLength(assignments), nil
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
func (srv *CanvasService) getUserSubmissionForQuiz(courseId, quizId, userId string, lastRun time.Time) (map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/quizzes/" + quizId + "/submissions/" + userId + "?submitted_since=" + lastRun.String()
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	if resp.StatusCode != 200 {
		log.Errorln("getUserSubmissionForQuiz canvas responded with code: ", resp.Status)
		return nil, errors.New("canvas responded with code: " + resp.Status)
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

func (srv *CanvasService) getUserSubmissionsForCourse(userId, courseId string, lastRun time.Time) ([]map[string]interface{}, error) {
	fields := log.Fields{"handler": "getUserSubmissionForQuiz"}
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/students/submissions?student_ids[]=" + userId + "&submitted_since=" + lastRun.String()
	log.WithFields(fields).Printf("url: %v", url)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.WithFields(fields).Printf("getUserSubmissionForQuiz Failed to send request: %v", err)
		return nil, err
	}
	if resp.StatusCode != 200 {
		log.WithFields(fields).Errorln("canvas responded with code: ", resp.Status)
		return nil, errors.New("canvas responded with code: " + resp.Status)
	}
	defer resp.Body.Close()
	var submission []map[string]interface{}
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
func (srv *CanvasService) ImportMilestonesForProgramUser(programIdPair map[string]interface{}, mapping *models.ProviderUserMapping, db *gorm.DB, lastRun time.Time) error {
	programId := int(programIdPair["id"].(float64))
	externalProgramId := programIdPair["external_id"].(string)
	fields := log.Fields{"handler": "ImportMilestonesForProgramUser", "user_id": mapping.UserID, "course_id": programId, "external_id": externalProgramId}
	submissions, err := srv.getUserSubmissionsForCourse(mapping.ExternalUserID, externalProgramId, lastRun)
	if err != nil {
		fields["error"] = err.Error()
		log.Printf("Failed to get submission for assignment: %v", err)
		return err
	}
	for _, submission := range submissions {
		milestone := models.Milestone{
			UserID:      mapping.UserID,
			ExternalID:  fmt.Sprintf("%d", int(submission["id"].(float64))),
			ProgramID:   uint(programId),
			Type:        "assignment_submission",
			IsCompleted: submission["workflow_state"] == "complete" || submission["workflow_state"] == "graded",
		}
		err = db.Create(&milestone).Error
		if err != nil {
			log.Errorln("failed to create milestone in GetMilestonesForProgramUser: ", err)
			continue
		}
	}
	quizzes, err := srv.getQuizzesForCourse(externalProgramId)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Failed to get quizzes for course")
		// just return what we have
		return nil
	}
	for _, quiz := range quizzes {
		// go through each quiz and see if we have a submission from the user
		quizId := int(quiz["id"].(float64))
		if submission, err := srv.getUserSubmissionForQuiz(externalProgramId, fmt.Sprintf("%d", quizId), mapping.ExternalUserID, lastRun); err == nil {
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
				UserID:     mapping.UserID,
				ProgramID:  uint(programId),
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

func (srv *CanvasService) ImportActivityForProgram(programPair map[string]interface{}, db *gorm.DB) error {
	programId := int(programPair["id"].(float64))
	externalId := programPair["external_id"].(string)
	enrollments, err := srv.getEnrollmentsForCourse(externalId)
	if err != nil {
		log.Printf("Failed to get enrollments for course: %v", err)
		return err
	}
	for _, enrollment := range enrollments {
		userId := fmt.Sprintf("%d", int(enrollment["user_id"].(float64)))
		var userID uint
		err := db.Model(models.ProviderUserMapping{}).Select("user_id").First(&userID, "provider_platform_id = ? AND external_user_id = ?", srv.ProviderPlatformID, userId).Error
		if err != nil {
			log.Printf("Failed to get user: %v", err)
			continue
		}
		totalTime := uint(enrollment["total_activity_time"].(float64))
		// NOTE: this is calling a stored procedure to calculate the time delta
		if err := db.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)", userID, programId, "program_interaction", totalTime, externalId).Error; err != nil {
			log.WithFields(log.Fields{"userId": userID, "program_id": programId, "error": err}).Error("Failed to create activity")
			continue
		}
	}
	return nil
}
