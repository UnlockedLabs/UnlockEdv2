package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

func TestHandleGetSectionsForProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetSectionsForProgramAsAdmin", "admin", getProgramId(), http.StatusOK, ""},
		{"TestGetSectionsForProgramAsUser", "student", getProgramId(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			progamIdMap := test.mapKeyValues
			if progamIdMap["err"] != nil {
				t.Fatalf("unable to get program id from db, error is %v", progamIdMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/programs/{id}/sections", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := progamIdMap["id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetSectionsForProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				args := models.QueryContext{
					Page:    1,
					PerPage: 10,
				}
				sections, err := server.Db.GetSectionsForProgram(int(id), &args)
				if err != nil {
					t.Errorf("failed to get sections for program from db, error is %v", err)
				}
				data := models.PaginatedResource[models.ProgramSection]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Meta.Total != args.Total {
					t.Errorf("handler returned unexpected total returned: got %v want %v", data.Meta.Total, args.Total)
				}
				for _, section := range sections {
					if !slices.ContainsFunc(data.Data, func(sec models.ProgramSection) bool {
						return sec.ID == section.ID
					}) {
						t.Error("sections for program not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleGetSection(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminGetSection", "admin", getSectionId(), http.StatusOK, ""},
		{"TestUserCanGetSection", "student", getSectionId(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionIdMap := test.mapKeyValues
			if sectionIdMap["err"] != nil {
				t.Fatalf("unable to get section id from db, error is %v", sectionIdMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/program-sections/{section_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := sectionIdMap["id"].(uint)
			req.SetPathValue("section_id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetSection, test.role)
			rr := executeRequest(t, req, handler, test)
			section, err := server.Db.GetSectionByID(int(id))
			if err != nil {
				t.Fatalf("unable to get section for program from db, error is %v", err)
			}
			received := rr.Body.String()
			data := models.Resource[models.ProgramSection]{}
			if err := json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if diff := cmp.Diff(section, &data.Data); diff != "" {
				t.Errorf("handler returned unexpected response body: %v", diff)
			}
		})
	}
}

func TestHandleIndexSectionsForFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllSectionsForFacilityAsAdmin", "admin", getSectionsSearch(1, ""), http.StatusOK, ""},
		{"TestGetAllSectionsForFacilityAsUser", "student", getSectionsSearch(1, ""), http.StatusOK, ""},
		//{"TestGetSeachSectionsForFacilityAsAdmin", "student", getSectionsSearch(1, "Potosi"), http.StatusOK, "?search=Potosi"},
		//{"TestGetSearchSectionsForFacilityAsUser", "student", getSectionsSearch(1, "Correctional"), http.StatusOK, "?search=Correctional"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionsMap := test.mapKeyValues
			if sectionsMap["err"] != nil {
				t.Fatalf("unable to get sections from db, error is %v", sectionsMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/program-sections%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexSectionsForFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.PaginatedResource[models.ProgramSection]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, section := range sectionsMap["sections"].([]models.ProgramSection) {
				if !slices.ContainsFunc(data.Data, func(sec models.ProgramSection) bool {
					return sec.ID == section.ID
				}) {
					t.Error("program sections not found, out of sync")
				}
			}
		})
	}
}

func TestHandleCreateSection(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateSection", "student", getProgramSection(1), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateSection", "admin", getProgramSection(1), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionMap := test.mapKeyValues
			if sectionMap["err"] != nil {
				t.Fatalf("unable to build program section, error is %v", sectionMap["err"])
			}
			jsonForm, err := json.Marshal(sectionMap["section"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/programs/{id}/sections", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateSection, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.ProgramSection]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				section, err := server.Db.GetSectionByID(int(data.Data.ID))
				if err != nil {
					t.Fatalf("unable to get program section from db, error is %v", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteProgramSection(int(data.Data.ID))
					if err != nil {
						fmt.Println(err)
					}
				})
				if diff := cmp.Diff(section, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleUpdateSection(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateSection", "admin", getProgramSection(1), http.StatusOK, ""},
		{"TestUserCannotUpdateSection", "student", getProgramSection(1), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionMap := test.mapKeyValues
			if sectionMap["err"] != nil {
				t.Fatalf("unable to build program section, error is %v", sectionMap["err"])
			}
			programSection := sectionMap["section"].(models.ProgramSection)
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				newSection, err := server.Db.CreateProgramSection(&programSection)
				if err != nil {
					t.Fatalf("failed to create program section, %v", err)
				}
				id = newSection.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteProgramSection(int(id)); err != nil {
						fmt.Println("Unable to delete program section. Error is: ", err)
					}
				})
			} else {
				id = 1
			}
			programSection.FacilityID = 2 //update
			jsonForm, err := json.Marshal(programSection)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/program-sections/{id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateSection, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedSection, err := server.Db.GetSectionByID(int(id))
				if err != nil {
					t.Fatalf("unable to get program section from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.ProgramSection]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(updatedSection, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleDeleteSection(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteSection", "student", getProgramSection(1), http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteSection", "admin", getProgramSection(1), http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionMap := test.mapKeyValues
			if sectionMap["err"] != nil {
				t.Fatalf("unable to build program section, error is %v", sectionMap["err"])
			}
			programSection := sectionMap["section"].(models.ProgramSection)
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				newSection, err := server.Db.CreateProgramSection(&programSection)
				if err != nil {
					t.Fatalf("failed to create program section, %v", err)
				}
				id = newSection.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/program-sections/{section_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("section_id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteSection, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Section deleted successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Section deleted successfully")
				}
			}
		})
	}
}

func getProgramSection(facilityId uint) map[string]any {
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
	form["section"] = models.ProgramSection{
		ProgramID:      programs[rand.Intn(len(programs))].ID,
		FacilityID:     facilityId,
		Capacity:       30,
		Name:           "Employment",
		InstructorName: "Maria Gonzalez",
		Description:    "Basic to advanced computer literacy and digital skills.",
		Duration:       "3mo",
		Status:         models.Scheduled, //this will change during new section development
		StartDt:        time.Now().Add(14 * 24 * time.Hour),
	}
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

func getSectionId() map[string]any {
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
	sections, err := server.Db.GetSectionsForProgram(int(programs[rand.Intn(len(programs))].ID), &args)
	if err != nil {
		form["err"] = err
	}
	if len(sections) > 0 {
		form["id"] = sections[rand.Intn(len(sections))].ID
	} else {
		form["id"] = uint(3)
	}
	return form
}

func getSectionsSearch(facilityId uint, search string) map[string]any {
	args := models.QueryContext{
		Page:       1,
		PerPage:    10,
		UserID:     1,
		FacilityID: facilityId,
		Search:     search,
	}
	sections, err := server.Db.GetSectionsForFacility(&args)
	form := make(map[string]any)
	form["sections"] = sections
	form["err"] = err
	form["total"] = args.Total
	return form
}
