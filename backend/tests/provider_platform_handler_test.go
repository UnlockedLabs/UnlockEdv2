package tests

import (
	"Go-Prototype/backend/cmd/models"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleIndexProviders(t *testing.T) {
	t.Parallel()
	t.Run("TestHandleIndexProviders", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/provider-platforms", nil)
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleIndexProviders))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		total, providers, err := server.Db.GetAllProviderPlatforms(1, 10)
		if err != nil {
			t.Errorf("failed to get users from db")
		}
		Response := models.PaginatedResource[models.ProviderPlatform]{
			Data: providers,
			Meta: models.PaginationMeta{
				CurrentPage: 1,
				PerPage:     10,
				Total:       total,
				LastPage:    1,
			},
		}
		data := models.PaginatedResource[models.ProviderPlatform]{}
		received := rr.Body.String()
		if err = json.Unmarshal([]byte(received), &data); err != nil {
			t.Errorf("failed to unmarshal response")
		}
		for i := 0; i < len(data.Data); i++ {
			if data.Meta.Total != Response.Meta.Total {
				t.Errorf("handler returned unexpected body: got %v want %v",
					data.Meta.Total, Response.Meta.Total)
			}
			if data.Data[i].Type != Response.Data[i].Type {
				t.Errorf("handler returned unexpected body: got %v want %v",
					data.Data[i].Type, Response.Data[i].Type)
			}
			if data.Data[i].Name != Response.Data[i].Name {
				t.Errorf("handler returned unexpected body: got %v want %v",
					data.Data[i].Name, Response.Data[i].Name)
			}
			if data.Data[i].Description != Response.Data[i].Description {
				t.Errorf("handler returned unexpected body: got %v want %v",
					data.Data[i].Description, Response.Data[i].Description)
			}
		}
	})
}

func TestHandleShowProvider(t *testing.T) {
	t.Parallel()
	t.Run("TestHandleShowProvider", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/api/provider-platforms/id", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.SetPathValue("id", "1")
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleShowProvider))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		provider, err := server.Db.GetProviderPlatformByID(1)
		if err != nil {
			t.Fatal(err)
		}
		received := rr.Body.String()
		resource := models.Resource[models.ProviderPlatform]{}
		resource.Data = append(resource.Data, *provider)
		userStr, err := json.Marshal(resource)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if strings.TrimSpace(received) != string(userStr) {
			t.Errorf("handler returned unexpected body: got %v want %v",
				received, string(userStr))
		}
	})
}

func TestCreateProvider(t *testing.T) {
	t.Run("TestCreateProvider", func(t *testing.T) {
		form := make(map[string]string)
		form["type"] = "test"
		form["name"] = "test"
		form["description"] = "test"
		form["base_url"] = "test"
		form["icon_url"] = "test"
		form["access_key"] = "test"
		jsonForm, err := json.Marshal(form)
		if err != nil {
			t.Errorf("failed to marshal form")
		}
		req, err := http.NewRequest("POST", "/api/provider-platforms", bytes.NewBuffer(jsonForm))
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleCreateProvider))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusCreated)
		}
		dest := models.ProviderPlatform{}
		if name, ok := form["name"]; ok {
			_ = server.Db.Conn.Where("name = ?", name).Find(&dest)
		}
		received := rr.Body.String()
		resource := models.Resource[models.ProviderPlatform]{
			Data:    make([]models.ProviderPlatform, 0),
			Message: "Provider platform created successfully",
		}
		resource.Data = append(resource.Data, dest)
		provStr, err := json.Marshal(&resource)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if !bytes.Equal([]byte(received)[:len([]byte(received))-1], provStr) {
			t.Errorf("handler returned unexpected body: got %v want %v",
				received, string(provStr))
		}
	})
}

func TestUpdateProvider(t *testing.T) {
	t.Run("TestUpdateProvider", func(t *testing.T) {
		form := make(map[string]string)
		form["type"] = "test"
		form["name"] = "test"
		form["description"] = "test"
		form["base_url"] = "test"
		form["icon_url"] = "test"
		form["access_key"] = "test"
		jsonForm, err := json.Marshal(form)
		if err != nil {
			t.Errorf("failed to marshal form")
		}
		req, err := http.NewRequest("PATCH", "/api/provider-platforms/", bytes.NewBuffer(jsonForm))
		if err != nil {
			t.Fatal(err)
		}
		req.SetPathValue("id", "1")
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleUpdateProvider))
		handler.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}
		prov, err := server.Db.GetProviderPlatformByID(1)
		if err != nil {
			t.Fatal(err)
		}
		prov.AccessKey = "test"
		received := rr.Body.String()
		receivedStruct := models.Resource[models.ProviderPlatform]{}
		_ = json.Unmarshal([]byte(received), &receivedStruct)
		updatedProv := receivedStruct.Data[0]
		updatedProv.AccessKey = "test"
		toStr, err := json.Marshal(updatedProv)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		provStr, err := json.Marshal(prov)
		if err != nil {
			t.Errorf("failed to marshal user")
		}
		if strings.TrimSpace(string(toStr)) != string(provStr) {
			t.Errorf("handler returned unexpected body: got %v want %v",
				string(toStr), string(provStr))
		}
	})
}
