package main

import (
	"UnlockEdv2/src/models"
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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
	return nil
}

func (kc *BrightspaceService) IntoCourse(bsCourse BrightspaceCourse) *models.Course {
	return nil
}

func (srv *BrightspaceService) GetPluginId(pluginName string) (string, error) {
	var pluginId string
	resp, err := srv.SendRequest(DataSetsEndpoint)
	if err != nil {
		return pluginId, err
	}
	defer resp.Body.Close()
	pluginData := []DataSetPlugin{}
	if err = json.NewDecoder(resp.Body).Decode(&pluginData); err != nil {
		return pluginId, err
	}
	for _, plugin := range pluginData {
		if plugin.Name == pluginName {
			pluginId = plugin.PluginId
			break
		} //end if
	}
	return pluginId, nil
}

func (srv *BrightspaceService) DownloadAndUnzipFile(targetDirectory string, targetFileName string, endpointUrl string) (string, error) {
	//initial method for download/unzip file--WIP
	var destPath string
	resp, err := srv.SendRequest(endpointUrl)
	if err != nil {
		return destPath, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		file, err := os.Create(filepath.Join(targetDirectory, targetFileName))
		if err != nil {
			return destPath, err
		}
		_, err = io.Copy(file, resp.Body)
		if err != nil {
			return destPath, err
		}
		file.Close()
		zipFile, err := zip.OpenReader(destPath) //open the zip file
		if err != nil {
			return destPath, err
		}
		defer zipFile.Close() //close it later
		for _, zippedFile := range zipFile.File {
			destPath := filepath.Join(targetDirectory, zippedFile.Name)
			if zippedFile.FileInfo().IsDir() {
				if err := os.MkdirAll(destPath, os.ModePerm); err != nil {
					fmt.Println("error occurred while trying to make directories, error is: ", err)
				}
				continue
			}
			//there is going to be no directory for this file, as these are csv files
			if err = os.MkdirAll(filepath.Dir(destPath), os.ModePerm); err != nil {
				return destPath, err
			}
			outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, zippedFile.Mode())
			if err != nil {
				return destPath, err
			}
			defer outFile.Close()
			rc, err := zippedFile.Open()
			if err != nil {
				return destPath, err
			}
			defer rc.Close()
			_, err = io.Copy(outFile, rc)
			if err != nil {
				return destPath, err
			}
		}
	}
	return destPath, err
}
