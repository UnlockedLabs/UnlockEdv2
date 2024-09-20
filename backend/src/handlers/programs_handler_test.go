package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleIndexPrograms(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProgramsAsAdmin", "admin", getAllPrograms(), http.StatusOK, ""},
		{"TestGetProgramsWithSearchAsAdmin", "admin", getProgramsBySearch(), http.StatusOK, "?search=to"},
		{"TestGetProgramsAsUser", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/programs", nil)
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexPrograms, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				programMap := test.mapKeyValues
				if programMap["err"] != nil {
					t.Errorf("failed to retrieve programs, error is %v", err)
				}
				data := models.PaginatedResource[models.Program]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				//loop through entire...list of programs
				for _, program := range programMap["programs"].([]models.Program) {
					if !slices.ContainsFunc(data.Data, func(prog models.Program) bool {
						return prog.ID == program.ID
					}) {
						t.Error("programs not found, out of sync")
					}
				}
			}
		})
	}
}

// special case on middleware uses (applyMiddleware)
func TestHandleShowProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetShowProgramAsAdmin", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestGetShowProgramAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/programs/", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleShowProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				program, err := server.Db.GetProgramByID(id)
				if err != nil {
					t.Fatal(err)
					return
				}
				received := rr.Body.String()
				resource := models.Resource[models.Program]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				if diff := cmp.Diff(program, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleCreateProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateProgram", "admin", getNewProgramForm(), http.StatusCreated, ""},
		{"TestUserCannotCreateProgram", "student", getNewProgramForm(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPost, "/api/programs", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				program := models.Program{}
				if err := server.Db.Model(&models.Program{}).Where("programs.name = ? AND programs.alt_name = ?", test.mapKeyValues["name"].(string), test.mapKeyValues["alt_name"].(string)).Find(&program).Error; err != nil {
					t.Fatal("failed to retrieve newly created program, error is ", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteProgram(int(program.ID))
					if err != nil {
						fmt.Println("error running clean for program that was created, error is ", err)
					}
				})
				if data.Message != "Program created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Program created successfully")
				}
			}
		})
	}
}

func TestHandleUpdateProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateProgram", "admin", map[string]any{"message": "Program deleted successfully"}, http.StatusOK, ""},
		{"TestUserCannotUpdateProgram", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			origProgram, err := getNewProgramModel()
			if err != nil {
				t.Fatal("", err)
			}
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				program, err := server.Db.CreateProgram(&origProgram)
				if err != nil {
					t.Errorf("failed to create program to update")
				}
				id = program.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteProgram(int(id)); err != nil {
						fmt.Println("error running clean for program that was created, error is ", err)
					}
				})
			} else {
				id = 1
			}
			jsonForm, err := json.Marshal(getUpdatedProgramForm())
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/programs/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedProgram, err := server.Db.GetProgramByID(int(id))
				if err != nil {
					t.Fatal(err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Program]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal program")
				}
				if diff := cmp.Diff(updatedProgram, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleDeleteProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteProgram", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteProgram", "admin", map[string]any{"message": "Program deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				programModel, err := getNewProgramModel()
				if err != nil {
					t.Fatal("failed to get a new program model, error is ", err)
				}
				program, err := server.Db.CreateProgram(&programModel)
				if err != nil {
					t.Errorf("failed to create program")
				}
				id = program.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/programs/", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}

func TestHandleFavoriteProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCanToggleFavoriteProgramOnOff", "student", map[string]any{"id": "4", "message": "Favorite updated successfully"}, http.StatusOK, ""},
		{"TestAdminCanToggleFavoriteProgramOnOff", "admin", map[string]any{"id": "4", "message": "Favorite updated successfully"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodDelete, "/api/programs/{id}/save", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleFavoriteProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
				//special case here, execute another request to toggle the user's favorite
				req.SetPathValue("id", test.mapKeyValues["id"].(string))
				rr = httptest.NewRecorder()
				handler.ServeHTTP(rr, req)
				if status := rr.Code; status != http.StatusNoContent {
					t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusNoContent)
				}
			}
		})
	}
}

func getAllPrograms() map[string]any {
	total, programs, err := server.Db.GetProgram(1, 10, "")
	form := make(map[string]any)
	form["programs"] = programs
	form["err"] = err
	form["total"] = total
	return form
}

func getProgramsBySearch() map[string]any {
	total, programs, err := server.Db.GetProgram(1, 10, "to")
	form := make(map[string]any)
	form["programs"] = programs
	form["err"] = err
	form["total"] = total
	return form
}

func getNewProgramModel() (models.Program, error) {
	program := models.Program{}
	form := getNewProgramForm()
	jsonString, err := json.Marshal(form)
	if err != nil {
		return program, err
	}
	err = json.Unmarshal(jsonString, &program)
	return program, err
}

func getNewProgramForm() map[string]any {
	form := make(map[string]any)
	form["created_at"] = "2024-09-17T12:07:52.102479Z"
	form["updated_at"] = "2024-09-17T12:07:52.102479Z"
	form["provider_platform_id"] = 1
	form["name"] = "Introduction to Human Resource Management"
	form["description"] = "An introductory course in human resource management, covering fundamental concepts such as how to deal with unruly employees, recruitment, and inteview strategies."
	form["external_id"] = "176"
	form["thumbnail_url"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/humanresources.jpg/640px-humanresources.jpg"
	form["type"] = "open_enrollment"
	form["outcome_types"] = "grade,college_credit"
	form["external_url"] = "https://staging.canvas.unlockedlabs.xyz/courses/176"
	form["alt_name"] = "BUS101"
	form["total_progress_milestones"] = 12
	return form
}

func getUpdatedProgramForm() map[string]any {
	form := make(map[string]any)
	form["provider_platform_id"] = 1
	form["name"] = "Introduction to Management"
	form["description"] = "A course in human resource management, covering fundamental concepts such as how to deal with unruly employees, recruitment, and inteview strategies."
	form["external_id"] = "176"
	form["thumbnail_url"] = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/humanresources.jpg/640px-humanresources.jpg"
	form["type"] = "open_enrollment"
	form["outcome_types"] = "college_credit"
	form["external_url"] = "https://staging.canvas.unlockedlabs.xyz/courses/176"
	form["alt_name"] = "BUS102"
	form["total_progress_milestones"] = 12
	return form
}
