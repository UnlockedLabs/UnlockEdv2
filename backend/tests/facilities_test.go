package tests

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

func TestIndexFacilities(t *testing.T) {
	t.Parallel()
	t.Run("TestIndexFacilities", func(t *testing.T) {
		request, err := http.NewRequest(http.MethodGet, "/api/facilities", nil)
		if err != nil {
			t.Error("error creating request")
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleIndexFacilities))
		handler.ServeHTTP(rr, request)
		facilities := models.Resource[models.Facility]{}
		if err = json.NewDecoder(rr.Body).Decode(&facilities); err != nil {
			t.Error("error decoding resp body")
		}
		all := make([]models.Facility, 0)
		if err := server.Db.Conn.Find(&all).Error; err != nil {
			t.Error("error fetching facilities from database")
		}
		for _, facility := range all {
			if !slices.ContainsFunc(facilities.Data, func(f models.Facility) bool {
				return f.ID == facility.ID
			}) {
				t.Error("facilities not found")
			}
		}
	})
}

func TestCreateFacility(t *testing.T) {
	t.Run("TestCreateFacility", func(t *testing.T) {
		newFacility := models.Facility{
			Name: "TestingFacility",
		}
		jsonBody, err := json.Marshal(newFacility)
		if err != nil {
			t.Fatal("error marshalling request body")
		}

		request, err := http.NewRequest(http.MethodPost, "/api/facilities", bytes.NewBuffer(jsonBody))
		if err != nil {
			t.Fatal("error creating request")
		}
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleCreateFacility))
		handler.ServeHTTP(rr, request)
		resp := rr.Result()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v", resp.StatusCode, http.StatusOK)
		}
		facilities := struct {
			Data []struct {
				Name string
				ID   int
			}
		}{}
		if err = json.NewDecoder(rr.Body).Decode(&facilities); err != nil {
			t.Fatalf("error decoding response body: %v", err)
		}
		if len(facilities.Data) == 0 {
			t.Fatal("expected at least one facility in the response")
		}
		created := facilities.Data[0]
		if strings.Compare(created.Name, "TestingFacility") != 0 {
			t.Errorf("incorrect output, expected: TestingFacility, got: " + created.Name)
		}
	})
}

func TestUpdateFacility(t *testing.T) {
	t.Run("TestUpdateFacility", func(t *testing.T) {
		facilities, err := server.Db.GetAllFacilities()
		if err != nil {
			t.Error("unable to get all facilities")
		}
		randomFacility := facilities[rand.Intn(len(facilities)-1)]
		randomFacility.Name = "TestingFacility"
		jsonBody, err := json.Marshal(randomFacility)
		if err != nil {
			t.Fatal("error marshalling request body")
		}
		request, err := http.NewRequest(http.MethodPatch, "/api/facilities/", bytes.NewBuffer(jsonBody))
		if err != nil {
			t.Fatal("error creating request")
		}
		request.SetPathValue("id", fmt.Sprintf("%d", randomFacility.ID))
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleUpdateFacility))
		handler.ServeHTTP(rr, request)
		resp := rr.Result()
		response := models.Resource[models.Facility]{}
		if resp.StatusCode != http.StatusOK {
			t.Logf("handler returned wrong status code: got %v want %v", resp.StatusCode, http.StatusOK)
		}
		if err = json.NewDecoder(resp.Body).Decode(&response); err != nil {
			t.Fatalf("error decoding response body: %v", err)
		}
		check, err := server.Db.GetFacilityByID(int(randomFacility.ID))
		if err != nil {
			t.Error("error getting newly updated facility")
		}
		if response.Data[0].Name != "TestingFacility" {
			t.Errorf("updated facility name: %s, expected TestingFacility", check.Name)
		}
		if check.Name != "TestingFacility" {
			t.Errorf("updated facility name: %s, expected TestingFacility", check.Name)
		}
	})
}

func TestDeleteFacility(t *testing.T) {
	t.Run("TestDeleteFacility", func(t *testing.T) {
		facilities, err := server.Db.GetAllFacilities()
		if err != nil {
			t.Error("unable to get all facilities")
		}
		randomFacility := facilities[rand.Intn(len(facilities)-1)]
		request, err := http.NewRequest(http.MethodDelete, "/api/facilities/", nil)
		if err != nil {
			t.Fatal("error creating request")
		}
		request.SetPathValue("id", fmt.Sprintf("%d", randomFacility.ID))
		rr := httptest.NewRecorder()
		handler := server.TestAsAdmin(http.HandlerFunc(server.HandleDeleteFacility))
		handler.ServeHTTP(rr, request)
		response := rr.Result()
		if response.StatusCode != http.StatusNoContent {
			t.Errorf("error deleting facility, expected %d, found %d", http.StatusNoContent, response.StatusCode)
		}
		_, err = server.Db.GetFacilityByID(int(randomFacility.ID))
		if err == nil {
			t.Error("error getting newly updated facility")
		}
	})
}
