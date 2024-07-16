package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
		description := ""
		if course["public_description"] != nil {
			description = course["public_description"].(string)
		} else {
			description = course["course_code"].(string)
		}
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
func (srv *CanvasService) getUserSubmissionForQuiz(courseId, quizId, userId string) (map[string]interface{}, error) {
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/quizzes/" + quizId + "/submissions/" + userId
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

func (srv *CanvasService) getUserSubmissionsForCourse(userId, courseId string) ([]map[string]interface{}, error) {
	fields := log.Fields{"handler": "getUserSubmissionForQuiz"}
	url := srv.BaseURL + "/api/v1/courses/" + courseId + "/students/submissions?student_ids[]=" + userId
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
func (srv *CanvasService) ImportMilestonesForProgramUser(userId, courseId uint, db *gorm.DB) error {
	fields := log.Fields{"handler": "ImportMilestonesForProgramUser", "user_id": userId, "course_id": courseId}
	var user models.User
	if err := db.Model(models.User{}).Where("id = ?", userId).First(&user).Error; err != nil {
		log.WithFields(fields).Errorln("unable to find user")
		return err
	}
	externalId, err := user.GetExternalIDFromProvider(db, srv.ProviderPlatformID)
	if err != nil {
		log.WithFields(fields).Errorln("unable to find external user login")
		return err
	}
	log.WithFields(fields).Debugf("external id for user %d: %s", user.ID, externalId)
	var courseID string
	err = db.Model(models.Program{}).Select("external_id").Where("id = ?", courseId).First(&courseID).Error
	if err != nil {
		log.Errorln("failed to get program with id in GetMilestonesForProgramUser: ", courseId)
		return err
	}
	submissions, err := srv.getUserSubmissionsForCourse(externalId, courseID)
	if err != nil {
		log.Printf("Failed to get submission for assignment: %v", err)
		return err
	}
	for _, submission := range submissions {
		milestone := models.Milestone{
			UserID:      uint(userId),
			ExternalID:  fmt.Sprintf("%d", int(submission["id"].(float64))),
			ProgramID:   uint(courseId),
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
		if submission, err := srv.getUserSubmissionForQuiz(courseID, fmt.Sprintf("%d", quizId), externalId); err == nil {
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
				UserID:     userId,
				ProgramID:  courseId,
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
		var user models.ProviderUserMapping
		err := db.Model(models.ProviderUserMapping{}).Select("user_id").Where("provider_platform_id = ?", srv.ProviderPlatformID).Where("external_user_id = ?", userId).Find(&user).Error
		if err != nil {
			log.Printf("Failed to get user: %v", err)
			continue
		}
		var program models.Program
		if err = db.Model(models.Program{}).Select("id").Where("provider_platform_id = ? AND external_id = ?", []interface{}{srv.ProviderPlatformID, courseId}).First(&program).Error; err != nil {
			log.Printf("Failed to get program: %v", err)
			continue
		}
		activity := models.Activity{
			ExternalID: courseId,
			UserID:     user.UserID,
			Type:       "interaction",
			TotalTime:  uint(enrollment["total_activity_time"].(float64)),
			ProgramID:  program.ID,
		}
		// NOTE: this is calling a stored procedure to calculate the time delta
		if err := db.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)", activity.UserID, activity.ProgramID, activity.Type, activity.TotalTime, activity.ExternalID).Error; err != nil {
			log.WithFields(log.Fields{"userId": user.ID, "program_id": courseId, "error": err}).Error("Failed to create activity")
			continue
		}
	}
	return nil
}
