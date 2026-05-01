package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"
)

type ProgramDeleteGuardTestSuite struct {
	suite.Suite
	env *TestEnv
}

func (suite *ProgramDeleteGuardTestSuite) SetupSuite() {
	suite.env = SetupTestEnv(suite.T())
}

func (suite *ProgramDeleteGuardTestSuite) TearDownSuite() {
	suite.env.CleanupTestEnv()
}

func (suite *ProgramDeleteGuardTestSuite) SetupTest() {
	suite.env.DB.Exec("DELETE FROM program_class_event_attendance")
	suite.env.DB.Exec("DELETE FROM program_class_events")
	suite.env.DB.Exec("DELETE FROM program_class_enrollments")
	suite.env.DB.Exec("DELETE FROM program_completions")
	suite.env.DB.Exec("DELETE FROM change_log_entries")
	suite.env.DB.Exec("DELETE FROM program_classes_history")
	suite.env.DB.Exec("DELETE FROM program_classes")
	suite.env.DB.Exec("DELETE FROM facilities_programs")
	suite.env.DB.Exec("DELETE FROM programs")
	suite.env.DB.Exec("DELETE FROM rooms")
	suite.env.DB.Exec("DELETE FROM facilities")
	suite.env.DB.Exec("DELETE FROM users WHERE role != 'system_admin'")
}

func (suite *ProgramDeleteGuardTestSuite) seedEmptyProgram() (*models.User, *models.Program, *models.Facility) {
	ts := fmt.Sprintf("%d", time.Now().UnixNano())
	facility := &models.Facility{Name: "F " + ts}
	suite.env.DB.Create(facility)
	admin := &models.User{
		NameFirst: "A", NameLast: "A",
		Username: "a" + ts, Email: "a" + ts + "@t.test",
		Role: models.SystemAdmin, FacilityID: facility.ID,
	}
	suite.env.DB.Create(admin)
	program := &models.Program{Name: "P " + ts, IsActive: true, Description: "x"}
	suite.env.DB.Create(program)
	suite.env.DB.Create(&models.FacilitiesPrograms{FacilityID: facility.ID, ProgramID: program.ID})
	return admin, program, facility
}

func (suite *ProgramDeleteGuardTestSuite) TestDelete_EmptyProgram_Succeeds() {
	admin, program, _ := suite.seedEmptyProgram()
	NewRequest[any](suite.env.Client, suite.T(), http.MethodDelete,
		fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: admin.ID}).
		Do().
		ExpectStatus(http.StatusNoContent)
}

func (suite *ProgramDeleteGuardTestSuite) TestDelete_ProgramWithAnyClass_Blocked() {
	admin, program, facility := suite.seedEmptyProgram()
	class := &models.ProgramClass{
		ProgramID: program.ID, FacilityID: facility.ID,
		Status: models.Scheduled, Name: "Empty", Capacity: 10, Description: "x",
	}
	suite.env.DB.Create(class)

	resp := NewRequest[models.DeleteBlockingChildren](suite.env.Client, suite.T(),
		http.MethodDelete, fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: admin.ID}).
		Do().
		ExpectStatus(http.StatusConflict)

	blockers := resp.GetData()
	suite.Equal(int64(1), blockers.Classes, "any class under the program blocks delete")

	var programCount int64
	suite.env.DB.Model(&models.Program{}).Where("id = ?", program.ID).Count(&programCount)
	suite.Equal(int64(1), programCount, "program should NOT be deleted")
}

func (suite *ProgramDeleteGuardTestSuite) TestDelete_BlockedByClassWithEnrollment() {
	admin, program, facility := suite.seedEmptyProgram()
	class := &models.ProgramClass{
		ProgramID: program.ID, FacilityID: facility.ID,
		Status: models.Active, Name: "C", Capacity: 10, Description: "x",
	}
	suite.env.DB.Create(class)
	student := &models.User{
		NameFirst: "S", NameLast: "S",
		Username: fmt.Sprintf("s%d", time.Now().UnixNano()),
		Email:    fmt.Sprintf("s%d@t.test", time.Now().UnixNano()),
		Role:     models.Student, FacilityID: facility.ID,
	}
	suite.env.DB.Create(student)
	suite.env.DB.Create(&models.ProgramClassEnrollment{
		ClassID: class.ID, UserID: student.ID, EnrollmentStatus: models.Enrolled,
	})

	resp := NewRequest[models.DeleteBlockingChildren](suite.env.Client, suite.T(), http.MethodDelete,
		fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: admin.ID}).
		Do().
		ExpectStatus(http.StatusConflict)

	got := resp.GetData()
	suite.Equal(int64(1), got.Classes, "should report 1 blocking class")
	suite.Equal(int64(1), got.Enrollments)

	var count int64
	suite.env.DB.Model(&models.Program{}).Where("id = ?", program.ID).Count(&count)
	suite.Equal(int64(1), count, "program should still exist after blocked delete")
}

func (suite *ProgramDeleteGuardTestSuite) TestDelete_BlockedAcrossMultipleClasses() {
	admin, program, facility := suite.seedEmptyProgram()
	c1 := &models.ProgramClass{
		ProgramID: program.ID, FacilityID: facility.ID,
		Status: models.Active, Name: "C1", Capacity: 5, Description: "x",
	}
	c2 := &models.ProgramClass{
		ProgramID: program.ID, FacilityID: facility.ID,
		Status: models.Scheduled, Name: "C2", Capacity: 5, Description: "x",
	}
	suite.env.DB.Create(c1)
	suite.env.DB.Create(c2)

	student := &models.User{
		NameFirst: "S", NameLast: "S",
		Username: fmt.Sprintf("s%d", time.Now().UnixNano()),
		Email:    fmt.Sprintf("s%d@t.test", time.Now().UnixNano()),
		Role:     models.Student, FacilityID: facility.ID,
	}
	suite.env.DB.Create(student)
	suite.env.DB.Create(&models.ProgramClassEnrollment{
		ClassID: c1.ID, UserID: student.ID, EnrollmentStatus: models.Enrolled,
	})

	room := &models.Room{FacilityID: facility.ID, Name: "101"}
	suite.env.DB.Create(room)
	suite.env.DB.Create(&models.ProgramClassEvent{
		ClassID:        c2.ID,
		Duration:       "1h0m0s",
		RecurrenceRule: "DTSTART:20260302T093000Z\nRRULE:FREQ=WEEKLY;COUNT=1",
		RoomID:         &room.ID,
	})

	resp := NewRequest[models.DeleteBlockingChildren](suite.env.Client, suite.T(), http.MethodDelete,
		fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: admin.ID}).
		Do().
		ExpectStatus(http.StatusConflict)

	got := resp.GetData()
	suite.Equal(int64(2), got.Classes)
	suite.Equal(int64(1), got.Enrollments)
	suite.Equal(int64(1), got.Events)
}

func TestProgramDeleteGuardTestSuite(t *testing.T) {
	suite.Run(t, new(ProgramDeleteGuardTestSuite))
}
