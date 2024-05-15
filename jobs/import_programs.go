package main

import (
	cmd "Go-Prototype/src"
	"Go-Prototype/src/handlers"

	log "github.com/sirupsen/logrus"
)

func importPrograms() error {
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
		programs, err := service.GetPrograms()
		if err != nil {
			log.Errorf("Error getting provider service programs: %v", err)
			continue
		}
		for _, program := range programs {
			_, err := server.Db.CreateProgram(&program)
			if err != nil {
				log.Errorf("Error creating program: %v", err)
				continue
			}
		}
	}
	return nil
}
