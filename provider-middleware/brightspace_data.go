package main

import (
	"UnlockEdv2/src/models"
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gocarina/gocsv"
	log "github.com/sirupsen/logrus"
)

type DataSetPlugin struct {
	PluginId     string  `json:"PluginId"`
	Name         string  `json:"Name"`
	Description  string  `json:"Description"`
	CreatedDate  string  `json:"CreatedDate"`
	DownloadLink string  `json:"DownloadLink"`
	DownloadSize float64 `json:"DownloadSize"`
}

type BrightspaceUser struct {
	UserId        string `csv:"UserId"`
	UserName      string `csv:"UserName"`
	OrgDefinedId  string `csv:"OrgDefinedId"`
	FirstName     string `csv:"FirstName"`
	LastName      string `csv:"LastName"`
	IsActive      string `csv:"IsActive"`
	Organization  string `csv:"Organization"`
	ExternalEmail string `csv:"ExternalEmail"`
}

type BrightspaceCourse struct {
	OrgUnitId         string `csv:"OrgUnitId"`
	Organization      string `csv:"Organization"`
	Type              string `csv:"Type"`
	Name              string `csv:"Name"`
	Code              string `csv:"Code"`
	IsActive          string `csv:"IsActive"`
	IsDeleted         string `csv:"IsDeleted"`
	OrgUnitTypeId     string `csv:"OrgUnitTypeId"`
	TotalContentCount int
}

type BrightspaceEnrollment struct {
	OrgUnitId      string `csv:"OrgUnitId"`
	UserId         string `csv:"UserId"`
	RoleName       string `csv:"RoleName"`
	EnrollmentType string `csv:"EnrollmentType"`
}

func (enroll *BrightspaceEnrollment) getCompositeKeyId() string {
	return enroll.UserId + "-" + enroll.OrgUnitId
}

type BrightspaceAssignmentSubmission struct {
	DropboxId           string `csv:"DropboxId"`
	OrgUnitId           string `csv:"OrgUnitId"`
	UserId              string `csv:"SubmitterId"`
	SubmitterType       string `csv:"SubmitterType"`
	FileSubmissionCount string `csv:"FileSubmissionCount"`
	Score               string `csv:"Score"`
	IsGraded            string `csv:"IsGraded"`
	LastSubmissionDate  string `csv:"LastSubmissionDate"`
}

func (assign *BrightspaceAssignmentSubmission) getCompositeKeyId() string {
	return assign.DropboxId + "-" + assign.OrgUnitId + "-" + assign.UserId
}

func (assign *BrightspaceAssignmentSubmission) getGradedCompositeKeyId() string {
	return "-assign-" + assign.DropboxId + "-" + assign.OrgUnitId + "-" + assign.UserId
}

type BrightspaceQuizSubmission struct {
	AttemptId string `csv:"AttemptId"`
	UserId    string `csv:"UserId"`
	OrgUnitId string `csv:"OrgUnitId"`
	Score     string `csv:"Score"`
	IsGraded  string `csv:"IsGraded"`
	IsDeleted string `csv:"IsDeleted"`
}

func (assign *BrightspaceQuizSubmission) getGradedCompositeKeyId() string {
	return "-quiz-" + assign.AttemptId
}

type BrightspaceContentObject struct {
	ContentObjectId   string `csv:"ContentObjectId"`
	OrgUnitId         string `csv:"OrgUnitId"`
	Title             string `csv:"Title"`
	ContentObjectType string `csv:"ContentObjectType"`
	CompletionType    string `csv:"CompletionType"`
	StartDate         string `csv:"StartDate"`
	EndDate           string `csv:"EndDate"`
	DueDate           string `csv:"DueDate"`
	LastModified      string `csv:"LastModified"`
	IsDeleted         string `csv:"IsDeleted"`
}

type BrightspaceContentUserProgress struct {
	ContentObjectId string `csv:"ContentObjectId"`
	UserId          string `csv:"UserId"`
	CompletedDate   string `csv:"CompletedDate"`
	LastVisited     string `csv:"LastVisited"`
	TotalTime       string `csv:"TotalTime"`
	Version         string `csv:"Version"`
}

func (bsProgress *BrightspaceContentUserProgress) getCompositeKeyId() string {
	return bsProgress.Version + "-" + bsProgress.ContentObjectId + "-" + bsProgress.UserId + "-" + bsProgress.LastVisited
}

type BrightspaceUserContentDto struct {
	OrgUnitId         string
	ContentObjectId   string
	TotalTime         string
	Title             string
	ContentObjectType string
	ExternalId        string
}

func (srv *BrightspaceService) IntoImportUser(bsUser BrightspaceUser) *models.ImportUser {
	user := models.ImportUser{
		Username:       bsUser.UserName,
		NameFirst:      bsUser.FirstName,
		NameLast:       bsUser.LastName,
		Email:          bsUser.ExternalEmail,
		ExternalUserID: bsUser.UserId,
	}
	return &user
}

func (srv *BrightspaceService) IntoCourse(bsCourse BrightspaceCourse) *models.Course {
	id := bsCourse.OrgUnitId
	courseImageUrl := fmt.Sprintf(srv.BaseURL+"/d2l/api/lp/1.28/courses/%s/image", id)
	response, err := srv.SendRequest(courseImageUrl)
	if err != nil {
		log.Errorf("error executing request to retrieve image from url %v, error is %v", courseImageUrl, err)
		return nil
	}
	defer response.Body.Close()
	var imgPath string
	var imgBytes []byte
	if response.StatusCode == http.StatusOK {
		imgBytes, err = io.ReadAll(response.Body)
		if err != nil {
			imgPath = "/brightspace.jpg"
		} else {
			imgPath, err = UploadBrightspaceImage(imgBytes, id)
			if err != nil {
				log.Errorf("error during upload of Brightspace image to UnlockEd, id used was: %v error is %v", id, err)
				imgPath = "/brightspace.jpg"
			}
		}
	}
	course := models.Course{
		ProviderPlatformID:      srv.ProviderPlatformID,
		ExternalID:              bsCourse.OrgUnitId,
		Name:                    bsCourse.Name,
		OutcomeTypes:            "completion",
		ThumbnailURL:            imgPath,
		Type:                    "fixed_enrollment",                             //open to discussion
		Description:             "Brightspace Managed Course: " + bsCourse.Name, //WIP
		TotalProgressMilestones: uint(bsCourse.TotalContentCount),
		ExternalURL:             srv.BaseURL + "/" + "d2l/le/sequenceLauncher/" + bsCourse.OrgUnitId + "/View",//WIP
	}
	return &course
}

func UploadBrightspaceImage(imgBytes []byte, bsCourseId string) (string, error) {
	filename := "image_brightspace" + "/" + bsCourseId + ".jpg"
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		log.Errorf("error creating form file using file %v, error is %v", filename, err)
		return "", err
	}
	if _, err = part.Write(imgBytes); err != nil {
		log.Errorf("error writing bytes to mulitpart form, error is %v", err)
		return "", err
	}
	err = writer.Close()
	if err != nil {
		log.Errorf("error closing file, error is %v", err)
		return "", err
	}
	uploadEndpointUrl := os.Getenv("APP_URL") + "/upload"
	request, err := http.NewRequest(http.MethodPost, uploadEndpointUrl, body)
	if err != nil {
		log.Errorf("error creating new POST request to url %v and error is: %v", uploadEndpointUrl, err)
		return "", err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Content-Length", fmt.Sprintf("%d", len(body.Bytes())))
	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		log.Errorf("error executing POST request to url %v and error is: %v", uploadEndpointUrl, err)
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("server returned non-OK status: %s", response.Status)
	}
	urlRes := struct {
		Data struct {
			Url string `json:"url"`
		}
		Message string `json:"message"`
	}{}
	err = json.NewDecoder(response.Body).Decode(&urlRes)
	if err != nil {
		return "", err
	}
	return urlRes.Data.Url, nil
}

func (srv *BrightspaceService) getPluginId(pluginName string) (string, error) {
	var pluginId string
	resp, err := srv.SendRequest(DataSetsEndpoint)
	if err != nil {
		return pluginId, err
	}
	defer resp.Body.Close()
	pluginData := []DataSetPlugin{}
	if err = json.NewDecoder(resp.Body).Decode(&pluginData); err != nil {
		log.Errorf("error decoding to response from url %v, error is: %v", DataSetsEndpoint, err)
		return pluginId, err
	}
	for _, plugin := range pluginData {
		if plugin.Name == pluginName {
			log.Infof("found plugin named %v with id %v", plugin.Name, plugin.PluginId)
			pluginId = plugin.PluginId
			break
		} //end if
	}
	return pluginId, nil
}

func readCSV[T any](values *T, csvFilePath string) {
	coursesFile, err := os.OpenFile(csvFilePath, os.O_RDWR|os.O_CREATE, os.ModePerm)
	if err != nil {
		log.Errorf("error opening file %v, error is: %v", csvFilePath, err)
		return
	}
	defer coursesFile.Close()
	if err := gocsv.UnmarshalFile(coursesFile, values); err != nil {
		log.Errorf("error parsing csv file %v into values type file, error is: %v", csvFilePath, err)
	}
}

func (srv *BrightspaceService) downloadAndUnzipFile(targetFileName string, endpointUrl string) (string, error) {
	var destPath string
	resp, err := srv.SendRequest(endpointUrl)
	if err != nil {
		return destPath, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Errorf("unable to download resource, response returned by brightspace request url %v was %v", endpointUrl, resp.StatusCode)
		return destPath, errors.New("unable to download plugin csv resource")
	}
	if resp.StatusCode == http.StatusOK {
		log.Infof("succesful request to url %v for downloading file %v", endpointUrl, targetFileName)
		zipFilePath := filepath.Join(CsvDownloadPath, targetFileName)
		targetDownloadDirectory := filepath.Dir(zipFilePath)
		err := os.MkdirAll(targetDownloadDirectory, os.ModePerm)
		if err != nil {
			log.Errorf("unable to create directory %s for downloading and zipping bulk data from Brightspace, error is %v", targetDownloadDirectory, err)
			return destPath, err
		}
		file, err := os.Create(zipFilePath)
		if err != nil {
			log.Errorf("error creating file %v used to write csv data into, error is: %v", zipFilePath, err)
			return destPath, err
		}
		_, err = io.Copy(file, resp.Body)
		if err != nil {
			log.Errorf("error writing response to file %v, error is: %v", zipFilePath, err)
			return destPath, err
		}
		err = file.Close()
		if err != nil {
			log.Errorf("error closing file %v, error is: %v", zipFilePath, err)
		}
		zipFile, err := zip.OpenReader(zipFilePath)
		if err != nil {
			log.Errorf("error opening zip file reader for file %v, error is: %v", zipFilePath, err)
			return destPath, err
		}
		defer func() {
			zipFile.Close()
			cleanUpFiles(zipFilePath) //delete zipfile here
		}()
		for _, zippedFile := range zipFile.File {
			destPath = filepath.Join(targetDownloadDirectory, zippedFile.Name)
			if zippedFile.FileInfo().IsDir() { //handles all zipped files
				if err := os.MkdirAll(destPath, os.ModePerm); err != nil {
					log.Errorf("error making directory to destination path %v, error is: %v", destPath, err)
				}
				continue
			}
			if err = os.MkdirAll(filepath.Dir(destPath), os.ModePerm); err != nil {
				log.Errorf("error making directory to destination path %v, error is: %v", destPath, err)
				return destPath, err
			}
			outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, zippedFile.Mode())
			if err != nil {
				log.Errorf("error openings %v, error is: %v", destPath, err)
				return destPath, err
			}
			defer outFile.Close()
			rc, err := zippedFile.Open()
			if err != nil {
				log.Errorf("error opening zipped file csv file %v, error is: %v", zippedFile.Name, err)
				return destPath, err
			}
			defer rc.Close()
			_, err = io.Copy(outFile, rc)
			if err != nil {
				log.Errorf("error copying zipped file %v to destination file %v, error is: %v", zippedFile.Name, destPath, err)
				return destPath, err
			}
		}
	}
	return destPath, err
}

func cleanUpCsvFiles(subDirectory string) {
	dirPath := filepath.Join(CsvDownloadPath, subDirectory)
	csvs, err := filepath.Glob(dirPath + "/*.csv")
	if err != nil {
		log.Errorln("error retrieving list of csv file paths, error is ", err)
		return
	}
	if len(csvs) > 0 {
		cleanUpFiles(csvs...)
	}
}

func cleanUpFiles(filePaths ...string) {
	for _, fileToDelete := range filePaths {
		if err := os.Remove(fileToDelete); err != nil {
			log.Warnf("unable to delete file %v", fileToDelete)
		}
	}
}

func findSlice[T any](inSlice []T, checkCondition func(T) bool) []T {
	var newSlice []T
	for _, theElement := range inSlice {
		if checkCondition(theElement) {
			newSlice = append(newSlice, theElement)
		}
	}
	return newSlice
}
