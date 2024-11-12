package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	CsvDownloadPath     = "csvs"
	TokenEndpoint       = "https://auth.brightspace.com/core/connect/token"
	DataSetsEndpoint    = "https://unlocked.brightspacedemo.com/d2l/api/lp/1.28/dataExport/bds/list"
	DataDownloadEnpoint = "https://unlocked.brightspacedemo.com/d2l/api/lp/1.28/dataExport/bds/download/%s"
)

type BrightspaceService struct {
	ProviderPlatformID uint
	Client             *http.Client
	BaseURL            string
	ClientID           string
	ClientSecret       string
	RefreshToken       string
	Scope              string
	AccessToken        string
	BaseHeaders        *map[string]string
	JobParams          *map[string]interface{}
	IsDownloaded       bool //flag to let process know that bulk data has been downloaded
	CsvFileMap         map[string]string
}

func newBrightspaceService(provider *models.ProviderPlatform, db *gorm.DB, params *map[string]interface{}) (*BrightspaceService, error) {
	keysSplit := strings.Split(provider.AccessKey, ";")
	if len(keysSplit) < 2 {
		return nil, errors.New("unable to find refresh token, unable to intialize BrightspaceService")
	}
	scope := os.Getenv("BRIGHTSPACE_SCOPE")
	if scope == "" {
		return nil, errors.New("no brightspace scope found, unable to intialize BrightspaceService")
	}
	brightspaceService := BrightspaceService{
		ProviderPlatformID: provider.ID,
		Client:             &http.Client{},
		BaseURL:            provider.BaseUrl,
		ClientID:           provider.AccountID,
		ClientSecret:       keysSplit[0],
		RefreshToken:       keysSplit[1],
		Scope:              scope,
		JobParams:          params,
	}
	data := url.Values{}
	data.Add("grant_type", "refresh_token")
	data.Add("refresh_token", brightspaceService.RefreshToken)
	data.Add("client_id", brightspaceService.ClientID)
	data.Add("client_secret", brightspaceService.ClientSecret)
	data.Add("scope", brightspaceService.Scope)
	log.Infof("refreshing token using endpoint url %v", TokenEndpoint)
	resp, err := brightspaceService.SendPostRequest(TokenEndpoint, data)
	if err != nil {
		log.Errorf("error sending post request to url %v", TokenEndpoint)
		return nil, err
	}
	var tokenMap map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenMap); err != nil {
		log.Errorf("error decoding to response from url %v, error is: %v", TokenEndpoint, err)
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		errType, okError := tokenMap["error"].(string)
		errMsg, okDesc := tokenMap["error_description"].(string)
		msg := "unable to request new refresh token from brightspace"
		if okError && okDesc {
			msg = fmt.Sprintf("unable to request new refresh token from brightspace, response error message is: %s: %s", errType, errMsg)
			return nil, errors.New(msg)
		}
		return nil, errors.New(msg)
	}
	brightspaceService.AccessToken = tokenMap["access_token"].(string)
	brightspaceService.RefreshToken = tokenMap["refresh_token"].(string)
	provider.AccessKey = brightspaceService.ClientSecret + ";" + brightspaceService.RefreshToken
	if err := db.Save(&provider).Error; err != nil {
		log.Errorf("error trying to update provider access_key with new refresh token, error is %v", err)
		return nil, err
	}
	log.Info("refresh token updated successfully on the provider_platform")
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + brightspaceService.AccessToken
	headers["Accept"] = "application/json"
	brightspaceService.BaseHeaders = &headers
	brightspaceService.CsvFileMap = make(map[string]string)
	return &brightspaceService, nil
}

func (srv *BrightspaceService) SendPostRequest(url string, data url.Values) (*http.Response, error) {
	encodedUrl := data.Encode()
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(encodedUrl))
	if err != nil {
		log.Errorf("error creating new POST request to url %v and error is: %v", url, err)
		return nil, err
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded") //standard header for url.Values (encoded)
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorf("error executing POST request to url %v and error is: %v", url, err)
		return nil, err
	}
	return resp, nil
}

func (srv *BrightspaceService) SendRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Errorf("error creating new GET request to url %v and error is: %v", url, err)
		return nil, err
	}
	for key, value := range *srv.BaseHeaders {
		req.Header.Add(key, value)
	}
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorf("error executing GET request to url %v and error is: %v", url, err)
		return nil, err
	}
	return resp, nil
}

func (srv *BrightspaceService) getBrightspaceBulkData(pluginName, zipFileName string) (string, error) {
	pluginId, err := srv.getPluginId(pluginName)
	if err != nil {
		log.Errorf("error attempting to get plugin id for %s, error is: %v", pluginName, err)
		return "", err
	}
	log.Infof("successfully retrieved plugin id %s for downloading csv file for %s", pluginId, pluginName)
	downloadUrl := fmt.Sprintf(DataDownloadEnpoint, pluginId)
	csvFile, err := srv.downloadAndUnzipFile(zipFileName, downloadUrl)
	if err != nil {
		log.Errorf("error attempting to download zip file for %s using plugin id %s, error is: %v", pluginName, pluginId, err)
		return "", err
	}
	log.Infof("successfully downloaded %s and unzipped %s", zipFileName, csvFile)
	return csvFile, err
}

func (srv *BrightspaceService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	csvFile, err := srv.getBrightspaceBulkData("Users", "Users.zip")
	if err != nil {
		log.Errorf("error attempting to get bulk data for Brightspace courses, error is: %v", err)
		return nil, err
	}
	bsUsers := []BrightspaceUser{}
	importUsers := []models.ImportUser{}
	readCSV(&bsUsers, csvFile)
	cleanUpFiles(csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "GetUsers", "csvFile": csvFile}
	log.WithFields(fields).Info("importing users from provider using csv file")
	for _, bsUser := range bsUsers {
		if strings.ToUpper(bsUser.IsActive) == "TRUE" {
			if db.Where("provider_platform_id = ? AND external_user_id = ?", srv.ProviderPlatformID, bsUser.UserId).First(&models.ProviderUserMapping{}).Error == nil {
				continue
			}
			user := srv.IntoImportUser(bsUser)
			importUsers = append(importUsers, *user)
		}
	}
	log.Info("successfully imported users from provider")
	return importUsers, nil
}

func (srv *BrightspaceService) ImportCourses(db *gorm.DB) error {
	csvFile, err := srv.getBrightspaceBulkData("Organizational Units", "OrganizationalUnits.zip")
	if err != nil {
		log.Errorf("error attempting to get bulk data for Brightspace courses, error is: %v", err)
		return err
	}
	bsCourses := []BrightspaceCourse{}
	readCSV(&bsCourses, csvFile)
	cleanUpFiles(csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportCourses", "csvFile": csvFile}
	log.WithFields(fields).Info("importing courses from provider using csv file")
	for _, bsCourse := range bsCourses {
		if strings.ToUpper(bsCourse.IsActive) == "TRUE" && strings.ToUpper(bsCourse.IsDeleted) == "FALSE" && bsCourse.Type == "Course Offering" {
			if db.Where("provider_platform_id = ? AND external_id = ?", srv.ProviderPlatformID, bsCourse.OrgUnitId).First(&models.Course{}).Error == nil {
				continue
			}
			log.Infof("importing course named %v with external id %v", bsCourse.Name, bsCourse.OrgUnitId)
			course := srv.IntoCourse(bsCourse)
			if err := db.Create(&course).Error; err != nil {
				log.Errorf("error creating course in db, error is: %v", err)
				continue
			}
		}
	}
	return nil
}

func (srv *BrightspaceService) ImportMilestones(course map[string]interface{}, users []map[string]interface{}, db *gorm.DB, lastRun time.Time) error {
	usersMap := make(map[string]uint)
	for _, user := range users {
		usersMap[user["external_user_id"].(string)] = uint(user["user_id"].(float64))
	}
	paramObj := milestonePO{
		course:   course,
		usersMap: usersMap,
	}
	if !srv.IsDownloaded {
		cleanUpCsvFiles()
	}
	err := importBSEnrollmentMilestones(srv, paramObj, db)
	if err != nil {
		log.Errorln("error importing enrollment milestones, error is ", err)
	}
	err = importBSAssignmentSubmissionMilestones(srv, paramObj, db)
	if err != nil {
		log.Errorln("error importing assignment submission milestones, error is ", err)
	}
	err = importBSQuizSubmissionMilestones(srv, paramObj, db)
	if err != nil {
		log.Errorln("error importing quiz submission milestones, error is ", err)
	}
	srv.IsDownloaded = true
	return nil
}

func importBSEnrollmentMilestones(srv *BrightspaceService, po milestonePO, db *gorm.DB) error {
	var csvFile string
	switch srv.IsDownloaded {
	case true:
		csvFile = srv.CsvFileMap["enrollments"]
	case false:
		csvFile, err := srv.getBrightspaceBulkData("User Enrollments", "UserEnrollments.zip")
		if err != nil {
			log.Errorf("error attempting to get bulk data for Brightspace enrollments, error is: %v", err)
			return err
		}
		srv.CsvFileMap["enrollments"] = csvFile
	}
	bsEnrollments := []BrightspaceEnrollment{}
	readCSV(&bsEnrollments, csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportMilestones.importBSEnrollmentMilestones", "csvFile": csvFile}
	log.WithFields(fields).Info("importing courses from provider using csv file")
	course := po.course
	usersMap := po.usersMap
	courseId := uint(course["course_id"].(float64))
	externalCourseId := course["external_course_id"].(string)
	filteredBSEnrollments := findSlice(bsEnrollments, func(bsCourse BrightspaceEnrollment) bool {
		return bsCourse.OrgUnitId == externalCourseId
	})
	var id string
	var userId uint
	for _, bsCourse := range filteredBSEnrollments {
		id = bsCourse.OrgUnitId
		userId = usersMap[bsCourse.UserId]
		if db.Where("user_id = ? AND course_id = ? AND external_id = ?", usersMap[bsCourse.UserId], courseId, id).First(&models.Milestone{}).Error == nil {
			continue
		}
		milestone := models.Milestone{
			UserID:     userId,
			CourseID:   courseId,
			ExternalID: id,
			Type:       models.Enrollment,
		}
		if err := db.Create(&milestone).Error; err != nil {
			log.Errorln("error creating brightspace enrollment milestone in db")
			continue
		}
	}
	return nil
}

func importBSAssignmentSubmissionMilestones(srv *BrightspaceService, po milestonePO, db *gorm.DB) error {
	var csvFile string
	switch srv.IsDownloaded {
	case true:
		csvFile = srv.CsvFileMap["assignments"]
	case false:
		csvFile, err := srv.getBrightspaceBulkData("Assignment Submissions", "AssignmentSubmissions.zip")
		if err != nil {
			log.Errorf("error attempting to get bulk data for Brightspace assignment submissions, error is: %v", err)
			return err
		}
		srv.CsvFileMap["assignments"] = csvFile
	}
	log.Infof("successfully downloaded and unzipped %v for importing user enrollments", csvFile)
	bsAssignments := []BrightspaceAssignmentSubmission{}
	readCSV(&bsAssignments, csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportMilestones.importBSAssignmentSubmissionMilestones", "csvFile": csvFile}
	log.WithFields(fields).Info("importing courses from provider using csv file")
	course := po.course
	usersMap := po.usersMap
	courseId := uint(course["course_id"].(float64))
	externalCourseId := course["external_course_id"].(string)
	filteredBSAssignments := findSlice(bsAssignments, func(bsAssignment BrightspaceAssignmentSubmission) bool {
		return bsAssignment.OrgUnitId == externalCourseId
	})
	var id string
	var userId uint
	var gradedId string
	for _, bsAssignment := range filteredBSAssignments {
		id = bsAssignment.getCompositeKeyId() //CREATE COMPOSITE FOR UNIQUENESS
		gradedId = strconv.Itoa(int(userId)) + bsAssignment.getGradedCompositeKeyId()
		userId = usersMap[bsAssignment.UserId]
		switch strings.ToUpper(bsAssignment.IsGraded) {
		case "TRUE":
			if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, gradedId).First(&models.Milestone{}).Error == nil {
				addAssignmentMilestoneIfNotExists(db, userId, courseId, bsAssignment)
				continue
			}
		case "FALSE":
			if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, id).First(&models.Milestone{}).Error == nil {
				continue
			}
		}
		milestone := models.Milestone{
			UserID:      userId,
			CourseID:    courseId,
			IsCompleted: true, //check
		}
		switch strings.ToUpper(bsAssignment.IsGraded) {
		case "TRUE":
			milestone.Type = models.GradeReceived
			milestone.ExternalID = gradedId

		case "FALSE":
			milestone.Type = models.AssignmentSubmission
			milestone.ExternalID = id
		}
		if err := db.Create(&milestone).Error; err != nil {
			log.Errorln("error creating milestone in db")
			continue
		}
	}
	return nil
}

func importBSQuizSubmissionMilestones(srv *BrightspaceService, po milestonePO, db *gorm.DB) error {
	var csvFile string
	switch srv.IsDownloaded {
	case true:
		csvFile = srv.CsvFileMap["quizzes"]
	case false:
		csvFile, err := srv.getBrightspaceBulkData("Quiz Attempts", "QuizAttempts.zip")
		if err != nil {
			log.Errorf("error attempting to get bulk data for Brightspace quiz attempts, error is: %v", err)
			return err
		}
		srv.CsvFileMap["quizzes"] = csvFile
	}
	log.Infof("successfully downloaded and unzipped %v for importing quiz submissions", csvFile)
	bsQuizes := []BrightspaceQuizSubmission{}
	readCSV(&bsQuizes, csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportMilestones.importBSQuizSubmissionMilestones", "csvFile": csvFile}
	log.WithFields(fields).Info("importing milestones from provider using csv file")
	course := po.course
	usersMap := po.usersMap
	courseId := uint(course["course_id"].(float64))
	externalCourseId := course["external_course_id"].(string)
	filteredBSQuizes := findSlice(bsQuizes, func(bsQuiz BrightspaceQuizSubmission) bool {
		return bsQuiz.OrgUnitId == externalCourseId && bsQuiz.IsDeleted == "False" //todo
	})
	var id string
	var userId uint
	var gradedId string
	for _, bsQuiz := range filteredBSQuizes {
		id = bsQuiz.AttemptId
		gradedId = strconv.Itoa(int(userId)) + bsQuiz.getGradedCompositeKeyId()
		userId = usersMap[bsQuiz.UserId]
		switch strings.ToUpper(bsQuiz.IsGraded) {
		case "TRUE":
			if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, gradedId).First(&models.Milestone{}).Error == nil {
				addQuizMilestoneIfNotExists(db, userId, courseId, bsQuiz)
				continue
			}
		case "FALSE":
			if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, id).First(&models.Milestone{}).Error == nil {
				continue
			}
		}
		milestone := models.Milestone{
			UserID:      userId,
			CourseID:    courseId,
			IsCompleted: true,
		}
		switch strings.ToUpper(bsQuiz.IsGraded) {
		case "TRUE":
			milestone.Type = models.GradeReceived
			milestone.ExternalID = gradedId
		case "FALSE":
			milestone.Type = models.QuizSubmission
			milestone.ExternalID = id
		}
		if err := db.Create(&milestone).Error; err != nil {
			log.Errorln("error creating milestone in db")
			continue
		}
	}
	return nil
}

func addAssignmentMilestoneIfNotExists(db *gorm.DB, userId, courseId uint, bsAssignment BrightspaceAssignmentSubmission) {
	if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, bsAssignment.getCompositeKeyId()).First(&models.Milestone{}).Error != nil {
		milestone := models.Milestone{
			UserID:      userId,
			CourseID:    courseId,
			IsCompleted: true,
			Type:        models.AssignmentSubmission,
			ExternalID:  bsAssignment.getCompositeKeyId(),
		}
		if err := db.Create(&milestone).Error; err != nil {
			log.Errorln("error creating assignment submission milestone in db, error is ", err)
		}
	}
}

func addQuizMilestoneIfNotExists(db *gorm.DB, userId, courseId uint, bsQuiz BrightspaceQuizSubmission) {
	if db.Where("user_id = ? AND course_id = ? AND external_id = ?", userId, courseId, bsQuiz.AttemptId).First(&models.Milestone{}).Error != nil {
		milestone := models.Milestone{
			UserID:      userId,
			CourseID:    courseId,
			IsCompleted: true,
			Type:        models.QuizSubmission,
			ExternalID:  bsQuiz.AttemptId,
		}
		if err := db.Create(&milestone).Error; err != nil {
			log.Errorln("error creating quiz submission milestone in db, error is ", err)
		}
	}
}

func (srv *BrightspaceService) ImportActivityForCourse(coursePair map[string]interface{}, db *gorm.DB) error {
	fmt.Println("ImportActivityForCourse...")
	return nil
}

func (srv *BrightspaceService) GetJobParams() *map[string]interface{} {
	return srv.JobParams
}
