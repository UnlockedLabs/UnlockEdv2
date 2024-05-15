package main

import (
	cmd "Go-Prototype/src"
	"Go-Prototype/src/handlers"

	log "github.com/sirupsen/logrus"
)

// hit action to import milestones from provider middleware
func importMilestones() error {
	server := handlers.NewServer(false)
	providers, err := server.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		log.Errorf("Error getting provider platforms: %v", err)
		return err
	}
	for _, provider := range providers {
		service, err := cmd.GetProviderService(&provider)
		if err != nil {
			log.Errorf("Error getting provider service: %v", err)
			continue
		}
		userMappings, err := server.Db.GetUserMappingsForProvider(provider.ID)
		if err != nil {
			log.Errorf("Error getting user mappings for provider: %v", err)
			continue
		}
		programs, err := server.Db.GetProgramByProviderPlatformID(int(provider.ID))
		if err != nil {
			log.Errorf("Error getting programs for provider: %v", err)
			continue
		}
		for _, program := range programs {
			for _, userMapping := range userMappings {
				milestones, err := service.GetMilestonesForProgramUser(program.ExternalID, userMapping.ExternalUserID)
				if err != nil {
					log.Errorf("Error getting provider service milestones: %v", err)
					continue
				}
				for _, milestone := range milestones {
					_, err := server.Db.CreateMilestone(&milestone)
					if err != nil {
						log.Errorf("Error creating milestone: %v", err)
						continue
					}
				}
			}
		}
	}
	return nil
}
