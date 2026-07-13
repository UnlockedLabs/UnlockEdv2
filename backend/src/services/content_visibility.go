package services

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
)

type ContentVisibilityService struct {
	db *database.DB
}

func NewContentVisibilityService(db *database.DB) *ContentVisibilityService {
	return &ContentVisibilityService{db: db}
}

func (svc *ContentVisibilityService) SetHelpfulLinkVisibility(args *models.QueryContext, id int, facilityIDs []uint, visible bool) error {
	link, err := svc.db.GetLinkFromId(uint(id))
	if err != nil {
		return err
	}
	statuses := buildVisibilityStatuses(link.ID, link.OpenContentProviderID, facilityIDs, visible)
	return svc.db.UpsertFacilityVisibilityStatuses(args, statuses, visible)
}

func (svc *ContentVisibilityService) SetVideoVisibility(args *models.QueryContext, id int, facilityIDs []uint, visible bool) error {
	video, err := svc.db.GetVideoByID(id, args.FacilityID)
	if err != nil {
		return err
	}
	statuses := buildVisibilityStatuses(video.ID, video.OpenContentProviderID, facilityIDs, visible)
	return svc.db.UpsertFacilityVisibilityStatuses(args, statuses, visible)
}

func (svc *ContentVisibilityService) SetLibraryVisibility(args *models.QueryContext, id int, facilityIDs []uint, visible bool) (*models.Library, error) {
	library, err := svc.db.GetLibraryByID(id)
	if err != nil {
		return nil, err
	}
	statuses := buildVisibilityStatuses(library.ID, library.OpenContentProviderID, facilityIDs, visible)
	if err := svc.db.UpsertFacilityVisibilityStatuses(args, statuses, visible); err != nil {
		return nil, err
	}
	library.VisibilityStatus = visible
	return library, nil
}

func buildVisibilityStatuses(contentID, providerID uint, facilityIDs []uint, visible bool) []models.FacilityVisibilityStatus {
	statuses := make([]models.FacilityVisibilityStatus, 0, len(facilityIDs))
	seen := make(map[uint]bool, len(facilityIDs))
	for _, facilityID := range facilityIDs {
		if seen[facilityID] {
			continue
		}
		seen[facilityID] = true
		statuses = append(statuses, models.FacilityVisibilityStatus{
			FacilityID:            facilityID,
			OpenContentProviderID: providerID,
			ContentID:             contentID,
			VisibilityStatus:      visible,
		})
	}
	return statuses
}
