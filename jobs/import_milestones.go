package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"

	log "github.com/sirupsen/logrus"
)

// hit action to import milestones from provider middleware
func importMilestones() error {
	providers, err := server.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		log.Errorf("Error getting all active provider platforms: %v", err)
		return err
	}
	for _, provider := range providers {
		request, err := http.NewRequest("POST", fmt.Sprintf("/actions/provider-platforms/%d/import-milestones", provider.ID), nil)
		if err != nil {
			log.Errorf("Error creating request: %v", err)
			return err
		}
		rr := httptest.NewRecorder()
		server.TestAsAdmin(http.HandlerFunc(server.HandleImportMilestones)).ServeHTTP(rr, request)
		if rr.Code != http.StatusOK {
			log.Errorf("Error importing milestones for provider %d: %v", provider.ID, rr.Body.String())
			return fmt.Errorf("error importing milestones for provider %d: %v", provider.ID, rr.Body.String())
		}
	}
	return nil
}
