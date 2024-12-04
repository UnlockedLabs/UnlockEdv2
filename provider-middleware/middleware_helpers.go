package main

import (
	"UnlockEdv2/src/models"
	"time"

	log "github.com/sirupsen/logrus"
)

const TIMEOUT_WAIT = 5

func (sh *ServiceHandler) LookupOpenContentProvider(id int) (*models.OpenContentProvider, error) {
	var provider models.OpenContentProvider
	if err := sh.db.Model(models.OpenContentProvider{}).Find(&provider, id).Error; err != nil {
		log.Errorf("Failed to fetch open content provider %v", err)
		return nil, err
	}
	return &provider, nil
}

func parseDate(dateToParse, pattern string) *time.Time {
	var (
		returnDt time.Time
		err      error
	)
	if dateToParse == "" {
		return &returnDt
	}
	returnDt, err = time.Parse(pattern, dateToParse)
	if err != nil {
		log.Errorf("error parsing date %s using pattern %s, error is: %v", dateToParse, pattern, err)
		return &returnDt
	}
	return &returnDt
}
