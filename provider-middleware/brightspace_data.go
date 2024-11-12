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
	OrgUnitId     string `csv:"OrgUnitId"`
	Organization  string `csv:"Organization"`
	Type          string `csv:"Type"`
	Name          string `csv:"Name"`
	Code          string `csv:"Code"`
	IsActive      string `csv:"IsActive"`
	IsDeleted     string `csv:"IsDeleted"`
	OrgUnitTypeId string `csv:"OrgUnitTypeId"`
}

type BrightspaceEnrollment struct {
	OrgUnitId      string `csv:"OrgUnitId"`
	UserId         string `csv:"UserId"`
	RoleName       string `csv:"RoleName"`
	EnrollmentType string `csv:"EnrollmentType"`
}

func (kc *BrightspaceService) IntoImportUser(bsUser BrightspaceUser) *models.ImportUser {
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
				imgPath = "/brightspace.png"
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
		TotalProgressMilestones: uint(0),                                        //WIP
		ExternalURL:             srv.BaseURL,                                    //WIP
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
		defer zipFile.Close() //close it later
		for _, zippedFile := range zipFile.File {
			destPath = filepath.Join(CsvDownloadPath, zippedFile.Name)
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

func cleanUpFiles(zipFileName, csvFile string) {
	zipFilePath := filepath.Join(CsvDownloadPath, zipFileName)
	if err := os.Remove(zipFilePath); err != nil {
		log.Warnf("unable to delete file %v", zipFilePath)
	}
	if err := os.Remove(csvFile); err != nil {
		log.Warnf("unable to delete file %v", csvFile)
	}
}
