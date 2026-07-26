package handlers

import (
	"UnlockEdv2/src/models"
	"slices"
	"testing"
)

// seedResolverFixtures creates the global feature flags and a facility that has
// disabled Learning Platforms (provider_platforms), so the facility-effective
// set diverges from the global set. Returns the facility id.
func seedResolverFixtures(t *testing.T, srv *Server) uint {
	t.Helper()
	flags := []models.FeatureFlags{
		{Name: models.OpenContentAccess, Enabled: true},
		{Name: models.ProviderAccess, Enabled: true},
		{Name: models.ProgramAccess, Enabled: true},
		{Name: models.LearningRecordAccess, Enabled: true},
	}
	for i := range flags {
		if err := srv.Db.Create(&flags[i]).Error; err != nil {
			t.Fatalf("failed to seed feature flag: %v", err)
		}
	}

	facility := models.Facility{Name: "Resolver Facility", Timezone: "America/Chicago"}
	if err := srv.Db.Create(&facility).Error; err != nil {
		t.Fatalf("failed to create facility: %v", err)
	}

	// Disable Learning Platforms for this facility only.
	override := models.FacilityFeatureFlag{
		FacilityID: facility.ID,
		Feature:    models.ProviderAccess,
		Enabled:    false,
	}
	if err := srv.Db.Create(&override).Error; err != nil {
		t.Fatalf("failed to create facility override: %v", err)
	}
	return facility.ID
}

// A system admin is a statewide operator and must keep the globally-enabled
// feature even when their home facility disabled it.
func TestResolveFeatureAccessFor_SystemAdminStaysStatewide(t *testing.T) {
	srv := newTestingServer()
	facilityID := seedResolverFixtures(t, srv)

	features := srv.resolveFeatureAccessFor(models.SystemAdmin, facilityID)
	if !slices.Contains(features, models.ProviderAccess) {
		t.Fatalf("expected system admin to retain %q despite facility disable, got %v", models.ProviderAccess, features)
	}
}

// A department admin is "located at" a facility, so a feature disabled there
// must be hidden for them too (reviewer issue #3).
func TestResolveFeatureAccessFor_DepartmentAdminGatedByFacility(t *testing.T) {
	srv := newTestingServer()
	facilityID := seedResolverFixtures(t, srv)

	features := srv.resolveFeatureAccessFor(models.DepartmentAdmin, facilityID)
	if slices.Contains(features, models.ProviderAccess) {
		t.Fatalf("expected department admin to lose %q disabled at their facility, got %v", models.ProviderAccess, features)
	}
	// Features not disabled at the facility remain available.
	if !slices.Contains(features, models.OpenContentAccess) {
		t.Fatalf("expected department admin to retain %q, got %v", models.OpenContentAccess, features)
	}
}

// Pinned users (facility admins, residents) resolve against the same facility
// set — unchanged by this fix, asserted here as a guardrail.
func TestResolveFeatureAccessFor_FacilityAdminGatedByFacility(t *testing.T) {
	srv := newTestingServer()
	facilityID := seedResolverFixtures(t, srv)

	features := srv.resolveFeatureAccessFor(models.FacilityAdmin, facilityID)
	if slices.Contains(features, models.ProviderAccess) {
		t.Fatalf("expected facility admin to lose %q disabled at their facility, got %v", models.ProviderAccess, features)
	}
}
