package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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
	BaseHeaders        map[string]string
	ClientID           string
	RedirectURI        string
	JobParams          map[string]any
}

func newCanvasService(provider *models.ProviderPlatform, params map[string]any) *CanvasService {
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + provider.AccessKey
	headers["Accept"] = "application/json"
	return &CanvasService{
		ProviderPlatformID: provider.ID,
		Client:             &http.Client{},
		BaseURL:            provider.BaseUrl,
		Token:              provider.AccessKey,
		AccountID:          provider.AccountID,
		BaseHeaders:        headers,
		JobParams:          params,
	}
}

func (srv *CanvasService) SendRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range srv.BaseHeaders {
		req.Header.Add(key, value)
	}
	resp, err := srv.Client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (cs *CanvasService) GetJobParams() map[string]any {
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
	defer func() {
		if resp.Body.Close() != nil {
			logger().Error("Failed to close response body")
		}
	}()
	users := make([]map[string]interface{}, 0)
	log.Printf("Request sent to canvas Users: %v", resp.Body)
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		log.Errorf("Failed to decode response: %v", err)
		return nil, err
	}
	log.Printf("Request sent to canvas Users: %v", users)
	unlockedUsers := make([]models.ImportUser, 0)
	for _, user := range users {
		loginId, ok := user["login_id"].(string)
		if !ok {
			continue
		}
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
			ExternalUsername: loginId,
			NameFirst:        nameFirst,
			NameLast:         nameLast,
			Email:            loginId,
			Username:         nameLast + nameFirst,
		}
		unlockedUsers = append(unlockedUsers, unlockedUser)
	}
	log.Printf("returning %d Unlocked Users", len(unlockedUsers))
	return unlockedUsers, nil
}

func (srv *CanvasService) ImportCourses(db *gorm.DB) error {
	url := srv.BaseURL + "/api/v1/accounts/" + srv.AccountID + "/courses?include[]=course_image&include[]=public_description"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return err
	}
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportCourses"}
	log.WithFields(fields).Info("importing courses from provider")
	defer func() {
		if resp.Body.Close() != nil {
			logger().Error("Failed to close response body")
		}
	}()
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
		if db.Table("courses").Where("provider_platform_id = ?", srv.ProviderPlatformID).
			Where("external_id = ?", fmt.Sprintf("%d", id)).
			Count(&count).Error != nil {
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
		if is_pub {
			progType = "open_enrollment"
		}
		unlockedCourse := models.Course{
			ProviderPlatformID:      srv.ProviderPlatformID,
			Name:                    course["name"].(string),
			AltName:                 course["course_code"].(string),
			ExternalID:              fmt.Sprintf("%d", id),
			ExternalURL:             srv.BaseURL + "/courses/" + fmt.Sprintf("%d", id),
			Type:                    models.CourseType(progType),
			OutcomeTypes:            "grade, college_credit",
			Description:             description,
			ThumbnailURL:            thumbnailURL,
			TotalProgressMilestones: uint(totalMilestones),
		}
		datePattern := "2006-01-02T15:04:05Z"
		if date, ok := course["start_at"].(string); ok {
			unlockedCourse.StartDt = parseDate(date, datePattern)
		}
		if date, ok := course["end_at"].(string); ok {
			unlockedCourse.EndDt = parseDate(date, datePattern)
		}
		if err = db.Create(&unlockedCourse).Error; err != nil {
			log.Printf("Failed to create course: %v", err)
			continue
		}
	}
	return nil
}

// it turns out that quizzes are included in the assignments for a course, so this was fetching duplicate data
//
//	func (srv *CanvasService) getQuizzesForCourse(externalCourseId string) ([]map[string]interface{}, error) {
//		url := srv.BaseURL + "/api/v1/courses/" + externalCourseId + "/quizzes"
//		resp, err := srv.SendRequest(url)
//		if err != nil {
//			log.Printf("Failed to send request: %v", err)
//			return nil, err
//		}
//		defer resp.Body.Close()
//		quizzes := make([]map[string]interface{}, 0)
//		err = json.NewDecoder(resp.Body).Decode(&quizzes)
//		if err != nil {
//			return nil, err
//		}
//		return quizzes, nil
//	}
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
	for key, value := range srv.BaseHeaders {
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
	defer func() {
		if resp.Body.Close() != nil {
			logger().Error("Failed to close response body")
		}
	}()
	assignments := make(map[string]interface{})
	err = json.NewDecoder(resp.Body).Decode(&assignments)
	if err != nil {
		log.Errorln("Error decoding json body from request: ", resp.Body)
		return 0, err
	}
	return getNodesLength(assignments), nil
}

// // external ID
// func (srv *CanvasService) getAssignmentsForCourse(courseId int) ([]interface{}, error) {
// 	url := srv.BaseURL + "/api/v1/courses/" + fmt.Sprintf("%d", courseId) + "/assignments"
// 	log.Printf("url: %v", url)
// 	resp, err := srv.SendRequest(url)
// 	if err != nil {
// 		log.Printf("Failed to send request: %v", err)
// 		return nil, err
// 	}
// 	defer resp.Body.Close()
// 	assignments := []interface{}{}
// 	err = json.NewDecoder(resp.Body).Decode(&assignments)
// 	if err != nil {
// 		log.Printf("failed to decode response from assignments %v", err)
// 		return nil, err
// 	}
// 	return assignments, nil
// }

// all external ids
// func (srv *CanvasService) getUserSubmissionForQuiz(courseId, quizId, userId string, lastRun time.Time) (map[string]interface{}, error) {
// 	queryParams := url.Values{}
// 	queryParams.Add("submitted_since", lastRun.Format(time.RFC3339))
// 	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/quizzes/" + quizId + "/submissions/" + userId
// 	url += "?" + queryParams.Encode()
// 	resp, err := srv.SendRequest(url)
// 	if err != nil {
// 		log.Printf("Failed to send request: %v", err)
// 		return nil, err
// 	}
// 	if resp.StatusCode != 200 {
// 		log.Errorln("getUserSubmissionForQuiz canvas responded with code: ", resp.Status)
// 		return nil, errors.New("canvas responded with code: " + resp.Status)
// 	}
// 	defer resp.Body.Close()
// 	submissions := make(map[string]interface{})
// 	err = json.NewDecoder(resp.Body).Decode(&submissions)
// 	if err != nil {
// 		return nil, err
// 	}
// 	if submissions == nil {
// 		return nil, fmt.Errorf("submission not found")
// 	}
// 	return submissions, nil
// }

func (srv *CanvasService) getUsersSubmissionsForCourse(courseId string, queryString url.Values, lastRun time.Time) ([]map[string]interface{}, error) {
	fields := log.Fields{"handler": "getUserSubmissionForCourse"}
	queryString.Add("submitted_since", lastRun.Format(time.RFC3339))
	queryString.Add("per_page", "100")
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/students/submissions"
	url += "?" + queryString.Encode()
	log.WithFields(fields).Printf("url: %v", url)
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.WithFields(fields).Printf("getUserSubmissionForCourse failed to send request: %v", err)
		return nil, err
	}
	if resp.StatusCode != 200 {
		log.WithFields(fields).Errorln("canvas responded with code: ", resp.Status)
		return nil, errors.New("canvas responded with code: " + resp.Status)
	}
	defer func() {
		if resp.Body.Close() != nil {
			logger().Error("Failed to close response body")
		}
	}()
	var submission []map[string]any
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
* Quizzes are included in assignments so we don't need to get them separately
* */
func (srv *CanvasService) ImportMilestones(courseIdPair map[string]any, mapping []map[string]any, db *gorm.DB, lastRun time.Time) error {
	courseId := int(courseIdPair["course_id"].(int64))
	externalCourseId := courseIdPair["external_course_id"].(string)
	values := url.Values{}
	reversed := make(map[string]int)
	for _, userMap := range mapping {
		reversed[userMap["external_user_id"].(string)] = int(userMap["user_id"].(int64))
		values.Add("user_ids[]", userMap["external_user_id"].(string))
	}
	fields := log.Fields{"task": "ImportMilestones", "course_id": courseId, "external_id": externalCourseId}
	submissions, err := srv.getUsersSubmissionsForCourse(externalCourseId, values, lastRun)
	if err != nil {
		fields["error"] = err.Error()
		log.Printf("Failed to get submission for assignment: %v", err)
		return err
	}
	for _, submission := range submissions {
		externalUserID := fmt.Sprintf("%d", int(submission["user_id"].(float64)))
		milestone := models.Milestone{
			UserID:      uint(reversed[externalUserID]),
			ExternalID:  fmt.Sprintf("%d", int(submission["id"].(float64))),
			CourseID:    uint(courseId),
			Type:        "assignment_submission",
			IsCompleted: submission["workflow_state"] == "complete" || submission["workflow_state"] == "graded",
		}
		if db.Create(&milestone).Error != nil {
			log.Errorln("failed to create milestone in GetMilestonesForCourseUser: ", err)
		}
		_, ok := submission["grade"].(string)
		if !ok {
			log.WithFields(fields).Traceln("no grade found for quiz submission")
			continue
		}
		if checkTimespanOfSubmission(lastRun, submission) {
			anonId := submission["anonymous_id"].(string)
			gradeReceived := models.Milestone{
				CourseID:    uint(courseId),
				UserID:      uint(reversed[externalUserID]),
				ExternalID:  anonId,
				Type:        "grade_received",
				IsCompleted: true,
			}
			if db.Create(&gradeReceived).Error != nil {
				log.WithFields(fields).Errorln("failed to create grade_received milestone: ", err)
				continue
			}
		}
	}
	return nil
}

func checkTimespanOfSubmission(lastRun time.Time, submission map[string]any) bool {
	if submission["submitted_at"] == nil {
		// assignment not submitted, so we don't care about it
		return false
	}
	submittedAt, err := time.Parse(time.RFC3339, submission["submitted_at"].(string))
	if err != nil {
		// failed to parse time, so we don't care about it
		return false
	}
	if submittedAt.After(lastRun) {
		// assignment was submitted after last run, so this is valid
		return true
	} else {
		// if not, we check if it was graded after last run
		if submission["graded_at"] == nil {
			return false
		}
		gradedAt, err := time.Parse(time.RFC3339, submission["graded_at"].(string))
		if err != nil {
			return false
		}
		if gradedAt.After(lastRun) {
			return true
		}
	}
	return false
}

func (srv *CanvasService) getEnrollmentsForCourse(courseId string) ([]map[string]any, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/enrollments?state[]=active&state[]=invited&type[]=StudentEnrollment"
	resp, err := srv.SendRequest(url)
	if err != nil {
		log.Printf("Failed to send request: %v", err)
		return nil, err
	}
	defer func() {
		if resp.Body.Close() != nil {
			logger().Error("Failed to close response body")
		}
	}()
	enrollments := make([]map[string]interface{}, 0)
	err = json.NewDecoder(resp.Body).Decode(&enrollments)
	if err != nil {
		return nil, err
	}
	return enrollments, nil
}

func (srv *CanvasService) ImportActivityForCourse(coursePair map[string]any, db *gorm.DB) error {
	courseId := int(coursePair["course_id"].(float64))
	externalId := coursePair["external_course_id"].(string)
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
		if db.Model(&models.UserEnrollment{}).First(&models.UserEnrollment{}, "user_id = ? AND course_id = ?", userID, courseId).RowsAffected == 0 {
			if err := db.Create(&models.UserEnrollment{UserID: userID, CourseID: uint(courseId)}).Error; err != nil {
				log.WithFields(log.Fields{"userId": userID, "course_id": courseId, "error": err}).Error("Failed to create enrollment")
				continue
			}
		}
		totalTime := uint(enrollment["total_activity_time"].(float64))
		// NOTE: this is calling a stored procedure to calculate the time delta
		if err := db.Exec("CALL insert_daily_activity_canvas(?, ?, ?, ?, ?, ?)", userID, courseId, "course_interaction", totalTime, externalId, time.Now()).Error; err != nil {
			log.WithFields(log.Fields{"userId": userID, "course_id": courseId, "error": err}).Error("Failed to create activity")
			continue
		}
	}
	return nil
}

// func (srv *CanvasService) ImportOutcomesForCourse(coursePair map[string]interface{}, userMappings []map[string]interface{}) error {
// 	courseId := int(coursePair["course_id"].(float64))
// 	externalId := coursePair["external_course_id"].(string)
// 	fields := log.Fields{"task": "ImportOutcomesForCourse", "course_id": courseId, "external_id": externalId}
// 	for _, mapping := range userMappings {
// 		userId := int(mapping["user_id"].(float64))
// 		externalUserId := mapping["external_user_id"].(string)
// 		log.WithFields(fields).Debug("importing outcomes from canvas")
//
// 	}
// }
