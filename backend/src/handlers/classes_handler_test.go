package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

func TestHandleGetClassesForProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetClassesForProgramAsAdmin", "admin", getProgramId(), http.StatusOK, ""},
		{"TestGetClassesForProgramAsUser", "student", getProgramId(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			programIdMap := test.mapKeyValues
			if programIdMap["err"] != nil {
				t.Fatalf("unable to get program id from db, error is %v", programIdMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/programs/{id}/classes", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := programIdMap["id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetClassesForProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				args := models.QueryContext{
					Page:       1,
					PerPage:    10,
					FacilityID: 1,
				}
				classes, err := server.Db.GetProgramClassDetailsByID(int(id), &args)
				if err != nil {
					t.Errorf("failed to get classes for program from db, error is %v", err)
				}
				data := models.PaginatedResource[models.ProgramClassDetail]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Meta.Total != args.Total {
					t.Errorf("handler returned unexpected total returned: got %v want %v", data.Meta.Total, args.Total)
				}
				for _, class := range classes {
					if !slices.ContainsFunc(data.Data, func(sec models.ProgramClassDetail) bool {
						return sec.ID == class.ID
					}) {
						t.Error("classes for program not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleGetClass(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminGetClass", "admin", getClassId(), http.StatusOK, ""},
		{"TestUserCanGetClass", "student", getClassId(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			classIdMap := test.mapKeyValues
			if classIdMap["err"] != nil {
				t.Fatalf("unable to get class id from db, error is %v", classIdMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/program-classes/{class_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := classIdMap["id"].(uint)
			req.SetPathValue("class_id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetClass, test.role)
			rr := executeRequest(t, req, handler, test)
			class, err := server.Db.GetClassByID(int(id))
			if err != nil {
				t.Fatalf("unable to get class for program from db, error is %v", err)
			}
			received := rr.Body.String()
			data := models.Resource[models.ProgramClass]{}
			if err := json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if diff := cmp.Diff(class, &data.Data); diff != "" {
				t.Errorf("handler returned unexpected response body: %v", diff)
			}
		})
	}
}

func TestHandleIndexClassesForFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllClassesForFacilityAsAdmin", "admin", getClassesSearch(1, ""), http.StatusOK, ""},
		{"TestGetAllClassesForFacilityAsUser", "student", getClassesSearch(1, ""), http.StatusOK, ""},
		//{"TestGetSeachClassesForFacilityAsAdmin", "student", getClassesSearch(1, "Potosi"), http.StatusOK, "?search=Potosi"},
		//{"TestGetSearchClassesForFacilityAsUser", "student", getClassesSearch(1, "Correctional"), http.StatusOK, "?search=Correctional"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			classesMap := test.mapKeyValues
			if classesMap["err"] != nil {
				t.Fatalf("unable to get classes from db, error is %v", classesMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/program-classes%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexClassesForFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.PaginatedResource[models.ProgramClass]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, class := range classesMap["classes"].([]models.ProgramClass) {
				if !slices.ContainsFunc(data.Data, func(sec models.ProgramClass) bool {
					return sec.ID == class.ID
				}) {
					t.Error("program classes not found, out of sync")
				}
			}
		})
	}
}

func TestHandleCreateClass(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateClass", "student", getProgramClass(1), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateClass", "admin", getProgramClass(1), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			classMap := test.mapKeyValues
			if classMap["err"] != nil {
				t.Fatalf("unable to build program class, error is %v", classMap["err"])
			}
			jsonForm, err := json.Marshal(classMap["class"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/programs/{id}/classes", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := classMap["program_id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleCreateClass, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.ProgramClass]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				class, err := server.Db.GetClassByID(int(data.Data.ID))
				if err != nil {
					t.Fatalf("unable to get program class from db, error is %v", err)
				}
				if class.ID != data.Data.ID {
					t.Errorf("handler returned unexpected results got %v want %v", class.ID, data.Data.ID)
				}
			}
		})
	}
}

func TestHandleUpdateClass(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateClass", "admin", getProgramClass(1), http.StatusOK, ""},
		{"TestUserCannotUpdateClass", "student", getProgramClass(1), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			classMap := test.mapKeyValues
			if classMap["err"] != nil {
				t.Fatalf("unable to build program class, error is %v", classMap["err"])
			}
			programClass := classMap["class"].(models.ProgramClass)
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				newClass, err := server.Db.CreateProgramClass(&programClass)
				if err != nil {
					t.Fatalf("failed to create program class, %v", err)
				}
				id = newClass.ID
			} else {
				id = 1
			}
			programClass.Capacity = 10 //update
			jsonForm, err := json.Marshal(programClass)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/program-classes/{id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateClass, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedClass, err := server.Db.GetClassByID(int(id))
				if err != nil {
					t.Fatalf("unable to get program class from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.ProgramClass]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(updatedClass, &data.Data); diff != "" && !strings.Contains(diff, "UpdatedAt") {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func getProgramClass(facilityId uint) map[string]any {
	form := make(map[string]any)
	args := models.QueryContext{
		Page:       1,
		PerPage:    10,
		UserID:     1,
		FacilityID: 1,
	}
	programs, err := server.Db.GetPrograms(&args)
	if err != nil {
		form["err"] = err
	}
	programID := programs[rand.Intn(len(programs))].ID
	endDt := time.Now().Add(20 * 24 * time.Hour)
	form["class"] = models.ProgramClass{
		ProgramID:      programID,
		FacilityID:     facilityId,
		Capacity:       30,
		Name:           "Employment",
		InstructorName: "Maria Gonzalez",
		Description:    "Basic to advanced computer literacy and digital skills.",
		Status:         models.Scheduled, //this will change during new class development
		StartDt:        time.Now().Add(14 * 24 * time.Hour),
		EndDt:          &endDt,
		Enrollments:    []models.ProgramClassEnrollment{},
	}
	form["program_id"] = programID
	return form
}
func getProgramId() map[string]any {
	form := make(map[string]any)
	args := models.QueryContext{
		Page:       1,
		PerPage:    10,
		UserID:     1,
		FacilityID: 1,
	}
	programs, err := server.Db.GetPrograms(&args)
	if err != nil {
		form["err"] = err
	}
	form["id"] = programs[rand.Intn(len(programs))].ID
	return form
}

func getClassId() map[string]any {
	form := make(map[string]any)
	args := models.QueryContext{
		Page:       1,
		PerPage:    10,
		UserID:     1,
		FacilityID: 1,
	}
	programs, err := server.Db.GetPrograms(&args)
	if err != nil {
		form["err"] = err
	}
	classes, err := server.Db.GetProgramClassDetailsByID(int(programs[rand.Intn(len(programs))].ID), &args)
	if err != nil {
		form["err"] = err
	}
	if len(classes) > 0 {
		form["id"] = classes[rand.Intn(len(classes))].ID
	} else {
		form["id"] = uint(3)
	}
	return form
}

func getClassesSearch(facilityId uint, search string) map[string]any {
	args := models.QueryContext{
		Page:       1,
		PerPage:    10,
		UserID:     1,
		FacilityID: facilityId,
		Search:     search,
	}
	classes, err := server.Db.GetClassesForFacility(&args)
	form := make(map[string]any)
	form["classes"] = classes
	form["err"] = err
	form["total"] = args.Total
	return form
}
