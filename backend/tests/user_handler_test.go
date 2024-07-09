package tests

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

func TestHandleIndexUsers(t *testing.T) {
	t.Parallel()
	t.Run("TestHandleIndexUsers", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/users", nil)
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleIndexUsers))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		total, dbUsers, err := server.Db.GetCurrentUsers(1, 10, 1, "")
		if err != nil {
			t.Errorf("failed to get users from db")
		}
		Response := models.PaginatedResource[models.User]{
			Data: dbUsers,
			Meta: models.PaginationMeta{
				CurrentPage: 1,
				PerPage:     10,
				Total:       total,
				LastPage:    1,
			},
		}
		data := models.PaginatedResource[models.User]{}
		received := rr.Body.String()
		if err = json.Unmarshal([]byte(received), &data); err != nil {
			t.Errorf("failed to unmarshal response")
		}
		if data.Meta.Total != Response.Meta.Total {
			t.Errorf("handler returned unexpected body: got %v want %v",
				data.Meta.Total, Response.Meta.Total)
		}
		if len(data.Data) != int(total) {
			t.Errorf("handler returned users from the wrong facility context")
		}
	})
}

func TestAssertFacilityContext(t *testing.T) {
	t.Parallel()
	t.Run("TestAssertFacilityContext", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/users", nil)
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleIndexUsers))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		_, dbUsers, err := server.Db.GetCurrentUsers(1, 10, 2, "")
		if err != nil {
			t.Errorf("failed to get users from db")
		}
		respUsers := models.Resource[models.User]{}
		if err := json.NewDecoder(rr.Body).Decode(&respUsers); err != nil {
			t.Errorf("failed to get users from db")
		}
		for _, user := range respUsers.Data {
			if slices.ContainsFunc(dbUsers, func(other models.User) bool {
				return user.Username == other.Username
			}) {
				t.Error("user found in multiple facility contexts")
			}
		}
	})
}

func TestAssertNonAdminCantViewAllUsers(t *testing.T) {
	t.Parallel()
	t.Run("TestAssertNonAdminCantViewAllUsers", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/users", nil)
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsUser(server.ApplyAdminMiddleware(http.HandlerFunc(server.HandleIndexUsers)))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusUnauthorized {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusUnauthorized)
		}
	})
}

func TestAssertNonAdminCanViewThemselves(t *testing.T) {
	t.Parallel()
	t.Run("TestAssertNonAdminCanViewThemselves", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/users/", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.SetPathValue("id", "4") // default non-admin testing user_id
		rr := httptest.NewRecorder()
		handler := server.TestAsUser(http.HandlerFunc(server.HandleShowUser))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusUnauthorized)
		}
	})
}

func TestHandleShowUser(t *testing.T) {
	t.Parallel()
	t.Run("TestHandleShowUser", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/users/", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.SetPathValue("id", "1")
		log.Println("request URL " + req.URL.String())
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleShowUser))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		user, err := server.Db.GetUserByID(1)
		if err != nil {
			t.Fatal(err)
			return
		}
		received := rr.Body.String()
		resource := models.Resource[models.User]{}
		resource.Data = append(resource.Data, *user)
		userStr, err := json.Marshal(resource)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if strings.Compare(strings.TrimSpace(received), strings.TrimSpace(string(userStr))) != 0 {
			t.Errorf("handler returned unexpected body: got %v want %v",
				received, string(userStr))
		}
	})
}

func TestCreateUser(t *testing.T) {
	t.Run("TestCreateUser", func(t *testing.T) {
		request := map[string]interface{}{}
		form := make(map[string]string)
		form["username"] = "test"
		form["name_first"] = "test"
		form["name_last"] = "test"
		form["email"] = "test"
		form["role"] = "admin"
		request["user"] = form
		request["providers"] = []int{}
		jsonForm, err := json.Marshal(request)
		if err != nil {
			t.Errorf("failed to marshal form")
		}
		req, err := http.NewRequest("POST", "/api/users", bytes.NewBuffer(jsonForm))
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleCreateUser))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusCreated {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusCreated)
		}
		user := server.Db.GetUserByUsername("test")
		if err != nil {
			t.Fatal(err)
		}
		received := rr.Body.String()
		if err := user.HashPassword(); err != nil {
			t.Errorf("failed to hash password")
		}
		userStr, err := json.Marshal(&user)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		unmarshed := handlers.NewUserResponse{}
		if err := json.Unmarshal([]byte(received), &unmarshed); err != nil {
			t.Errorf("failed to unmarshal user")
		}
		newUser := unmarshed.User
		toBytes, err := json.Marshal(&newUser)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if !bytes.Equal(toBytes, userStr) {
			t.Errorf("handler returned unexpected body: got %v want %v",
				string(toBytes), string(userStr))
		}
	})
}

func TestUpdateUser(t *testing.T) {
	t.Run("TestUpdateUser", func(t *testing.T) {
		// create user to update
		newUser := models.User{
			NameFirst:  "testUser",
			NameLast:   "testUser",
			Username:   "testUser",
			Email:      "testUser",
			Role:       "admin",
			FacilityID: 1,
		}
		created, err := server.Db.CreateUser(&newUser)
		if err != nil {
			t.Errorf("failed to create user")
		}
		id := created.ID
		form := make(map[string]string)
		form["username"] = "testUpdate"
		form["name_first"] = "testUpdate"
		form["name_last"] = "testUpdate"
		form["email"] = "testUpdate"
		form["role"] = "admin"
		jsonForm, err := json.Marshal(form)
		if err != nil {
			t.Errorf("failed to marshal form")
		}
		req, err := http.NewRequest("PATCH", "/api/users/", bytes.NewBuffer(jsonForm))
		if err != nil {
			t.Fatal(err)
		}
		req.SetPathValue("id", fmt.Sprintf("%d", id))
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleUpdateUser))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		user := server.Db.GetUserByUsername("testUpdate")
		if err != nil {
			t.Fatal(err)
		}
		received := rr.Body.String()
		if err := user.HashPassword(); err != nil {
			t.Errorf("failed to hash password")
		}
		resource := models.Resource[models.User]{}
		resource.Data = append(resource.Data, *user)
		userStr, err := json.Marshal(&resource)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if strings.TrimSpace(received) != string(userStr) {
			t.Errorf("handler returned unexpected body: got %v want %v",
				received, string(userStr))
		}
	})
}
