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

func (sh *ServiceHandler) lookupUserMapping(params map[string]any) ([]map[string]any, error) {
	providerPlatformId := int(params["provider_platform_id"].(float64))
	users := make([]map[string]any, 0, 25) // rough class size estimate
	if err := sh.db.Model(models.ProviderUserMapping{}).Select("user_id, external_user_id").
		Joins("JOIN users u on provider_user_mappings.user_id = u.id").
		Find(&users, "provider_platform_id = ? AND u.role = 'student'", providerPlatformId).
		Error; err != nil {
		logger().Errorf("failed to fetch users: %v", err)
	}
	return users, nil
}

func (sh *ServiceHandler) lookupCoursesMapping(provId int) ([]map[string]any, error) {
	courses := make([]map[string]any, 0, 10)
	if err := sh.db.Model(models.Course{}).Select("id as course_id, external_id as external_course_id").
		Find(&courses, "provider_platform_id = ?", provId).
		Error; err != nil {
		logger().Errorf("failed to fetch courses: %v", err)
	}
	return courses, nil
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
