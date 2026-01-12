package integration

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"UnlockEdv2/src/models"
)

func TestAuditFieldPopulation(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.TestServer.Close()
	defer env.Cancel()

	// Create a test user for audit purposes
	adminUser := models.User{
		Username:  "audit_admin",
		NameFirst: "Audit",
		NameLast:  "Admin",
		Email:     "audit_admin@unlocked.v2",
		Role:      models.SystemAdmin,
		FacilityID: 1,
	}
	if err := env.DB.Create(&adminUser).Error; err != nil {
		t.Fatalf("Failed to create test admin user: %v", err)
	}

	// Test program creation using the test client
	programData := map[string]interface{}{
		"name":         "Test Audit Program",
		"description":  "Program for testing audit fields",
		"funding_type": "Federal_Grants",
		"is_active":    true,
		"program_types": []models.ProgramType{
			{ProgramType: models.Educational, ProgramID: 0},
		},
		"credit_types": []models.ProgramCreditType{
			{CreditType: models.Completion, ProgramID: 0},
		},
		"facilities": []uint{1},
	}

	// Create the program using the test infrastructure
	resp := NewRequest[map[string]interface{}](env.Client, t, "POST", "/api/programs", programData).
		WithTestClaims(map[string]interface{}{
			"user_id":   adminUser.ID,
			"username":  adminUser.Username,
			"role":      adminUser.Role,
			"facility_id": adminUser.FacilityID,
		}).
		Do()

	if resp.resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status 201, got %d", resp.resp.StatusCode)
	}

	// Get the created program ID from response
	responseData := resp.GetData()
	createdProgramID := uint(responseData["id"].(float64))

	// Query the created program directly from database to check audit fields
	var createdProgram models.Program
	if err := env.DB.First(&createdProgram, createdProgramID).Error; err != nil {
		t.Fatalf("Failed to query created program: %v", err)
	}

	// Verify audit fields are set correctly on create
	if models.DerefUint(createdProgram.CreateUserID) == 0 {
		t.Error("CreateUserID should be set after creation")
	}
	if models.DerefUint(createdProgram.CreateUserID) != adminUser.ID {
		t.Errorf("Expected CreateUserID %d, got %d", adminUser.ID, models.DerefUint(createdProgram.CreateUserID))
	}
	if models.DerefUint(createdProgram.UpdateUserID) != 0 {
		t.Errorf("UpdateUserID should be nil/zero on initial creation, got %d", models.DerefUint(createdProgram.UpdateUserID))
	}

	// Test program update
	updateData := map[string]interface{}{
		"name":        "Updated Audit Program",
		"description": "Updated program description",
	}

	// Update the program
	updateResp := NewRequest[map[string]interface{}](env.Client, t, "PATCH", fmt.Sprintf("/api/programs/%d", createdProgramID), updateData).
		WithTestClaims(map[string]interface{}{
			"user_id":   adminUser.ID,
			"username":  adminUser.Username,
			"role":      adminUser.Role,
			"facility_id": adminUser.FacilityID,
		}).
		Do()

	if updateResp.resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", updateResp.resp.StatusCode)
	}

	// Query the updated program
	var updatedProgram models.Program
	if err := env.DB.First(&updatedProgram, createdProgramID).Error; err != nil {
		t.Fatalf("Failed to query updated program: %v", err)
	}

	// Verify audit fields after update
	if models.DerefUint(updatedProgram.CreateUserID) != adminUser.ID {
		t.Errorf("CreateUserID should not change on update. Expected %d, got %d", adminUser.ID, models.DerefUint(updatedProgram.CreateUserID))
	}
	if models.DerefUint(updatedProgram.UpdateUserID) != adminUser.ID {
		t.Errorf("UpdateUserID should be set to current user. Expected %d, got %d", adminUser.ID, models.DerefUint(updatedProgram.UpdateUserID))
	}

	// Verify the data actually changed
	if updatedProgram.Name != "Updated Audit Program" {
		t.Errorf("Expected program name to be updated, got: %s", updatedProgram.Name)
	}
	if updatedProgram.Description != "Updated program description" {
		t.Errorf("Expected program description to be updated, got: %s", updatedProgram.Description)
	}
}

func TestAuditFieldsWithDifferentUsers(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.TestServer.Close()
	defer env.Cancel()

	// Create two different users
	firstUser := models.User{
		Username:  "first_user",
		NameFirst: "First",
		NameLast:  "User",
		Email:     "first_user@unlocked.v2",
		Role:      models.DepartmentAdmin,
		FacilityID: 1,
	}
	if err := env.DB.Create(&firstUser).Error; err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	secondUser := models.User{
		Username:  "second_user",
		NameFirst: "Second",
		NameLast:  "User",
		Email:     "second_user@unlocked.v2",
		Role:      models.DepartmentAdmin,
		FacilityID: 1,
	}
	if err := env.DB.Create(&secondUser).Error; err != nil {
		t.Fatalf("Failed to create second user: %v", err)
	}

	// Create program with first user
	programData := map[string]interface{}{
		"name":         "Multi User Test Program",
		"description":  "Testing audit with multiple users",
		"funding_type": "State_Grants",
		"is_active":    true,
		"program_types": []models.ProgramType{
			{ProgramType: models.Vocational, ProgramID: 0},
		},
		"facilities": []uint{1},
	}

	// Create program with first user using NewRequest
	createResp := NewRequest[map[string]interface{}](env.Client, t, "POST", "/api/programs", programData).
		WithTestClaims(map[string]interface{}{
			"user_id":     firstUser.ID,
			"username":    firstUser.Username,
			"role":        firstUser.Role,
			"facility_id": firstUser.FacilityID,
		}).
		Do()

	if createResp.resp.StatusCode != http.StatusCreated {
		t.Fatalf("Failed to create program with first user, status: %d", createResp.resp.StatusCode)
	}

	createdProgramData := createResp.GetData()
	createdProgramID := uint(createdProgramData["id"].(float64))

	// Query the created program
	var createdProgram models.Program
	if err := env.DB.First(&createdProgram, createdProgramID).Error; err != nil {
		t.Fatalf("Failed to query created program: %v", err)
	}

	// Verify creation audit fields
	if models.DerefUint(createdProgram.CreateUserID) != firstUser.ID {
		t.Errorf("Expected CreateUserID %d (first user), got %d", firstUser.ID, createdProgram.CreateUserID)
	}
	if models.DerefUint(createdProgram.UpdateUserID) != 0 {
		t.Errorf("Expected UpdateUserID to be nil/zero on create, got %d", createdProgram.UpdateUserID)
	}

	// Update program with second user
	updateData := map[string]interface{}{
		"name": "Updated by Second User",
	}

	updateResp := NewRequest[map[string]interface{}](env.Client, t, "PATCH", fmt.Sprintf("/api/programs/%d", createdProgram.ID), updateData).
		WithTestClaims(map[string]interface{}{
			"user_id":     secondUser.ID,
			"username":    secondUser.Username,
			"role":        secondUser.Role,
			"facility_id": secondUser.FacilityID,
		}).
		Do()

	if updateResp.resp.StatusCode != http.StatusOK {
		t.Fatalf("Failed to update program with second user, status: %d", updateResp.resp.StatusCode)
	}

	updatedProgramData := updateResp.GetData()
	updatedProgramID := uint(updatedProgramData["id"].(float64))

	// Query the updated program
	var updatedProgram models.Program
	if err := env.DB.First(&updatedProgram, updatedProgramID).Error; err != nil {
		t.Fatalf("Failed to query updated program: %v", err)
	}

	// Verify audit fields after update by different user
	if models.DerefUint(updatedProgram.CreateUserID) != firstUser.ID {
		t.Errorf("CreateUserID should remain unchanged. Expected %d, got %d", firstUser.ID, updatedProgram.CreateUserID)
	}
	if models.DerefUint(updatedProgram.UpdateUserID) != secondUser.ID {
		t.Errorf("UpdateUserID should be updated to second user. Expected %d, got %d", secondUser.ID, updatedProgram.UpdateUserID)
	}
}

func TestSystemBatchUserBackfill(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.TestServer.Close()
	defer env.Cancel()

	if env.DB.Dialector.Name() == "sqlite" {
		t.Skip("sqlite tests do not run migrations/backfill for system_batch")
	}

	// Create a facility directly in the database to test backfill
	facility := models.Facility{
		Name:     "Test Facility",
		Timezone: "America/Chicago",
	}
	if err := env.DB.Create(&facility).Error; err != nil {
		t.Fatalf("Failed to create facility: %v", err)
	}

	// Query the facility to check if audit fields were set
	var queriedFacility models.Facility
	if err := env.DB.First(&queriedFacility, facility.ID).Error; err != nil {
		t.Fatalf("Failed to query facility: %v", err)
	}

	// After migration, the facility should have audit fields populated
	if models.DerefUint(queriedFacility.CreateUserID) == 0 {
		t.Error("CreateUserID should be set by backfill/migration")
	}

	// Find the system batch user
	var systemBatchUser models.User
	if err := env.DB.Where("username = ?", "system_batch").First(&systemBatchUser).Error; err != nil {
		t.Fatalf("System batch user should exist: %v", err)
	}

	// Verify the backfill was done with system batch user
	if models.DerefUint(queriedFacility.CreateUserID) != systemBatchUser.ID {
		t.Errorf("Expected CreateUserID to be system batch user (%d), got %d", systemBatchUser.ID, queriedFacility.CreateUserID)
	}

	// UpdateUserID should be NULL for existing records
	if models.DerefUint(queriedFacility.UpdateUserID) != 0 {
		t.Errorf("UpdateUserID should be NULL for backfilled records, got %d", queriedFacility.UpdateUserID)
	}
}

func TestAuditFieldConstraints(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.TestServer.Close()
	defer env.Cancel()

	if env.DB.Dialector.Name() == "sqlite" {
		t.Skip("sqlite tests do not enforce foreign key constraints in this setup")
	}

	// Try to create a record with invalid user ID (non-existent user)
	// This should fail due to foreign key constraint
	invalidUserProgram := models.Program{
		Name:        "Invalid User Program",
		Description: "This should fail due to foreign key constraint",
		FundingType: models.Other,
		IsActive:    true,
		DatabaseFields: models.DatabaseFields{
			CreateUserID: models.UintPtr(999999), // Non-existent user ID
			UpdateUserID: models.UintPtr(999999), // Non-existent user ID
		},
	}

	err := env.DB.Create(&invalidUserProgram).Error
	if err == nil {
		t.Error("Expected foreign key constraint violation when using non-existent user ID")
	}

	// Test that creating with NULL audit fields is allowed (for system operations)
	nullAuditProgram := models.Program{
		Name:        "System Operation Program",
		Description: "Created by system operations",
		FundingType: models.Other,
		IsActive:    true,
	}

	err = env.DB.Create(&nullAuditProgram).Error
	if err != nil {
		t.Errorf("Should allow creation with NULL audit fields: %v", err)
	}
}

func TestAuditFieldsPerformance(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.TestServer.Close()
	defer env.Cancel()

	// Create a user for testing
	testUser := models.User{
		Username:  "perf_test_user",
		NameFirst: "Performance",
		NameLast:  "Test",
		Email:     "perf_test@unlocked.v2",
		Role:      models.DepartmentAdmin,
		FacilityID: 1,
	}
	if err := env.DB.Create(&testUser).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	env.Context = context.WithValue(env.Context, models.UserIDKey, testUser.ID)

	// Create multiple programs and verify audit fields are properly set
	for i := 0; i < 10; i++ {
		program := models.Program{
			Name:        fmt.Sprintf("Performance Test Program %d", i),
			Description: fmt.Sprintf("Testing performance of audit fields %d", i),
			FundingType: models.Other,
			IsActive:    true,
		}

		// Simulate creating with user context (similar to what WithUserContext does)
		err := env.DB.WithContext(env.Context).Model(&program).Create(&program).Error
		if err != nil {
			t.Fatalf("Failed to create program %d: %v", i, err)
		}

		// Verify audit fields were set by hooks
		if models.DerefUint(program.CreateUserID) != testUser.ID {
			t.Errorf("Program %d: Expected CreateUserID %d, got %d", i, testUser.ID, program.CreateUserID)
		}
		if models.DerefUint(program.UpdateUserID) != 0 {
			t.Errorf("Program %d: Expected UpdateUserID to be nil/zero on create, got %d", i, program.UpdateUserID)
		}
	}

	// Test querying by audit fields to verify indexes are working
	var programs []models.Program
	start := time.Now()
	err := env.DB.Where("create_user_id = ?", testUser.ID).Find(&programs).Error
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("Failed to query programs by audit field: %v", err)
	}

	if len(programs) != 10 {
		t.Errorf("Expected 10 programs, got %d", len(programs))
	}

	// Query should be fast with index (this is a rough check)
	if duration > 100*time.Millisecond {
		t.Logf("Warning: Query took %v, consider checking audit field indexes", duration)
	}
}
