package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleIndexPrograms(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProgramsAsAdmin", "admin", getAllPrograms(), http.StatusOK, ""},
		{"TestGetProgramsWithSearchAsAdmin", "admin", getProgramsBySearch("self-paced,eligible_good_time", "to"), http.StatusOK, "?tags=self-paced,eligible_good_time&search=to"},
		{"TestGetProgramsAsUser", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/programs%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
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
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
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

func TestHandleShowProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetShowProgramAsAdmin", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestGetShowProgramAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/programs/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleShowProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				program, err := server.Db.GetProgramByID(id)
				if err != nil {
					t.Fatalf("unable to get program from db, error is %v", err)
				}
				received := rr.Body.String()
				resource := models.Resource[models.Program]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
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
			if test.mapKeyValues["err"] != nil {
				t.Fatalf("unable to create new program form, error is %v", test.mapKeyValues["err"])
			}
			jsonForm, err := json.Marshal(test.mapKeyValues["program"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/programs", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
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
			form := getNewProgramForm()
			if form["err"] != nil {
				t.Fatalf("unable to create new program form, error is %v", form["err"])
			}
			programToUpdate := form["program"].(models.Program)
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				err := server.Db.CreateProgram(&programToUpdate)
				if err != nil {
					t.Fatalf("unable to create program, error is %v", err)
				}
				id = programToUpdate.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteProgram(int(id)); err != nil {
						fmt.Println("unable to cleanup/delete program, error is ", err)
					}
				})
			} else {
				id = 1
			}
			jsonForm, err := json.Marshal(getUpdatedProgramForm())
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/programs/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedProgram, err := server.Db.GetProgramByID(int(id))
				if err != nil {
					t.Fatalf("unable to get program from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Program]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
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
				form := getNewProgramForm()
				if form["err"] != nil {
					t.Fatalf("unable to create new program form, error is %v", form["err"])
				}
				programToDelete := form["program"].(models.Program)
				err := server.Db.CreateProgram(&programToDelete)
				if err != nil {
					t.Fatalf("unable to create program, error is %v", err)
				}
				id = programToDelete.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/programs/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
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
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleFavoriteProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
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
	total, programs, err := server.Db.GetProgram(1, 10, nil, "")
	form := make(map[string]any)
	form["programs"] = programs
	form["err"] = err
	form["total"] = total
	return form
}

func getProgramsBySearch(tags string, search string) map[string]any {
	total, programs, err := server.Db.GetProgram(1, 10, strings.Split(tags, ","), search)
	form := make(map[string]any)
	form["programs"] = programs
	form["err"] = err
	form["total"] = total
	return form
}

func getNewProgramForm() map[string]any {
	form := make(map[string]any)
	var facilities []models.Facility
	if err := server.Db.Find(&facilities).Error; err != nil {
		form["err"] = err
	}
	form["program"] = models.Program{
		Name:          "Program for facility: " + strconv.Itoa(rand.Intn(1000)) + facilities[rand.Intn(len(facilities))].Name,
		Description:   "Testing program",
		CreditType:    "Participation Credit",
		ProgramStatus: "Available",
		ProgramType:   "Educational",
	}
	return form
}

func getUpdatedProgramForm() map[string]any {
	form := make(map[string]any)
	form["name"] = "Introduction to Management"
	form["description"] = "A course in human resource management, covering fundamental concepts such as how to deal with unruly employees, recruitment, and inteview strategies."
	form["credit_type"] = "Earned-Time Credit"
	form["program_status"] = "ARCHIVED"
	form["program_type"] = "THERAPEUTIC"

	return form
}