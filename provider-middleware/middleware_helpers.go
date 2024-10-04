package main

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) LookupOpenContentProvider(id int) (*models.OpenContentProvider, error) {
	var provider models.OpenContentProvider
	if err := sh.db.Model(models.OpenContentProvider{}).Find(&provider, id).Error; err != nil {
		log.Errorf("Failed to fetch open content provider %v", err)
		return nil, err
	}
	return &provider, nil
}
