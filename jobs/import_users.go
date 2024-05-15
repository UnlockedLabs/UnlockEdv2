package main

import (
	cmd "Go-Prototype/src"
	"Go-Prototype/src/handlers"
	"Go-Prototype/src/models"

	"github.com/sirupsen/logrus"
)

func importUsers() error {
	server := handlers.NewServer(false)
	providers, err := server.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		logrus.Errorf("Error getting provider platforms: %v", err)
		return err
	}
	for _, provider := range providers {
		service, err := cmd.GetProviderService(&provider)
		if err != nil {
			logrus.Errorf("Error getting provider service: %v", err)
			continue
		}
		users, err := service.GetUsers()
		if err != nil {
			logrus.Errorf("Error getting provider service users: %v", err)
			continue
		}
		for _, user := range users {
			if user.ExternalUserID == "" {
				logrus.Errorf("User does not have an external ID: %v", user)
				continue
			}
			foundMapping, err := server.Db.GetProviderUserMappingByExternalUserID(user.ExternalUserID, service.ProviderPlatformID)
			if err == nil && foundMapping != nil {
				// if this mapping already exists for the user in the provider, we skip it
				continue
			}
			newUser := models.User{
				NameLast:  user.NameLast,
				NameFirst: user.NameFirst,
				Email:     user.Email,
				Username:  user.Username,
			}
			created, err := server.Db.CreateUser(&newUser)
			if err != nil {
				logrus.Errorf("Error creating user: %v", err)
				continue
			}
			mapping := models.ProviderUserMapping{
				ProviderPlatformID: service.ProviderPlatformID,
				UserID:             created.ID,
				ExternalUserID:     user.ExternalUserID,
				ExternalUsername:   user.ExternalUsername,
				ExternalLoginID:    user.ExternalUsername,
			}
			if err := server.Db.CreateProviderUserMapping(&mapping); err != nil {
				logrus.Errorf("Error creating provider user mapping: %v", err)
				continue
			}
		}
	}
	return nil
}
