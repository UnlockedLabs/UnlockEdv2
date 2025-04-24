package main

import (
	"UnlockEdv2/src/models"
	"context"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func InsertDailyProgHistory(ctx context.Context, db *gorm.DB) error {
	if err := InsertDailyProgramsFacilitiesHistory(ctx, db); err != nil {
		log.Errorln("error inserting daily programs facilities history")
		return err
	}
	if err := InsertDailyProgramFacilitiesHistory(ctx, db); err != nil {
		log.Errorln("error inserting daily program facilities history")
		return err
	}
	if err := InsertDailyProgramFacilityHistory(ctx, db); err != nil {
		log.Errorln("error inserting daily program facility history")
		return err
	}
	return nil
}

func InsertDailyProgramsFacilitiesHistory(ctx context.Context, db *gorm.DB) error {
	var history models.DailyProgramsFacilitiesHistory
	var programStats struct {
		TotalPrograms         int64 `json:"total_programs"`
		TotalActivePrograms   int64 `json:"total_active_programs"`
		TotalArchivedPrograms int64 `json:"total_archived_programs"`
	}
	if err := db.WithContext(ctx).Model(&models.Program{}).
		Select(`
			COUNT(*) AS total_programs,
			SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) AS total_active_programs,
			SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS total_archived_programs
		`).
		Scan(&programStats).Error; err != nil {
		log.Errorln("error getting total, active, archived programs")
		return err
	}
	history.TotalPrograms = programStats.TotalPrograms
	history.TotalActivePrograms = programStats.TotalActivePrograms
	history.TotalArchivedPrograms = programStats.TotalArchivedPrograms

	var enrollmentStats struct {
		TotalEnrollments int64 `json:"total_enrollments"`
		TotalCompletions int64 `json:"total_completions"`
	}
	if err := db.WithContext(ctx).Model(&models.ProgramClassEnrollment{}).
		Select(`
			COUNT(*) AS total_enrollments,
			SUM(CASE WHEN enrollment_status = 'Completed' THEN 1 ELSE 0 END) AS total_completions
		`).
		Scan(&enrollmentStats).Error; err != nil {
		log.Errorln("error getting total, completed enrollments")
		return err
	}
	history.TotalEnrollments = enrollmentStats.TotalEnrollments
	history.TotalCompletions = enrollmentStats.TotalCompletions

	var totalProgramOfferings int64
	if err := db.WithContext(ctx).Model(&models.FacilitiesPrograms{}).
		Joins("JOIN programs ON programs.id = facilities_programs.program_id AND programs.is_active = true").
		Select("COUNT(*) AS total_program_offerings").
		Scan(&totalProgramOfferings).Error; err != nil {
		log.Errorln("error getting total program offerings")
		return err
	}
	history.TotalProgramOfferings = totalProgramOfferings

	var totalFacilities int64
	if err := db.WithContext(ctx).Model(&models.Facility{}).
		Select("COUNT(*) AS total_facilities").
		Scan(&totalFacilities).Error; err != nil {
		log.Errorln("error getting total facilities")
		return err
	}
	history.TotalFacilities = totalFacilities

	var attendanceStats struct {
		TotalAttendancesMarked int64 `json:"total_attendances_marked"`
		TotalStudentsPresent   int64 `json:"total_students_present"`
	}
	if err := db.WithContext(ctx).Model(&models.ProgramClassEventAttendance{}).
		Select(`
		COUNT(CASE WHEN attendance_status IS NOT NULL THEN 1 END) AS total_attendances_marked,
		COALESCE(SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END), 0) AS total_students_present
		`).
		Scan(&attendanceStats).Error; err != nil {
		log.Errorln("error getting total students present")
		return err
	}
	history.TotalStudentsPresent = attendanceStats.TotalStudentsPresent
	history.TotalAttendancesMarked = attendanceStats.TotalAttendancesMarked

	history.Date = time.Now()

	log.Infof("History struct before insert: %+v", history)
	if err := db.Create(&history).Error; err != nil {
		log.Errorln("error creating daily program history")
		return err
	}

	return nil
}

func InsertDailyProgramFacilitiesHistory(ctx context.Context, db *gorm.DB) error {
	programs := make([]models.DailyProgramFacilitiesHistory, 10)
	tx := db.Model(&models.Program{}).
		Select(`
			programs.id AS program_id,
			COUNT(DISTINCT CASE WHEN programs.is_active THEN fp.facility_id END) AS total_active_facilities,
			COUNT(DISTINCT pce.id) AS total_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Completed' THEN pce.id END) AS total_completions,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' THEN pce.id END) AS total_active_enrollments,
			COUNT(DISTINCT CASE WHEN pc.status != 'Cancelled' THEN pc.id END) AS total_classes,
			COUNT(DISTINCT CASE WHEN programs.archived_at IS NOT NULL THEN programs.id END) AS total_archived_classes,
			COUNT(DISTINCT CASE WHEN pcea.attendance_status IS NOT NULL THEN pcea.id END) AS total_attendances_marked,
			COUNT(DISTINCT CASE WHEN pcea.attendance_status = 'present' THEN pcea.id END) AS total_students_present
		`).
		Joins("LEFT JOIN program_classes pc ON pc.program_id = programs.id").
		Joins("LEFT JOIN facilities_programs fp ON fp.program_id = programs.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
		Joins("LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id").
		Group("programs.id")
	if err := tx.Scan(&programs).Error; err != nil {
		log.Errorln("error getting daily program facilities history")
		return err
	}

	now := time.Now()
	for i := range programs {
		programs[i].Date = now
	}

	if len(programs) > 0 {
		if err := db.Create(&programs).Error; err != nil {
			log.Errorln("error creating daily program facilities history")
			return err
		}
	}

	return nil
}

func InsertDailyProgramFacilityHistory(ctx context.Context, db *gorm.DB) error {
	histories := make([]models.DailyProgramFacilityHistory, 25)
	tx := db.Model(&models.Program{}).
		Select(`
			programs.id AS program_id,
			fp.facility_id AS facility_id,
			COUNT(DISTINCT CASE WHEN programs.is_active THEN fp.facility_id END) AS total_active_facilities,
			COUNT(DISTINCT pce.id) AS total_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Completed' THEN pce.id END) AS total_completions,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' THEN pce.id END) AS total_active_enrollments,
			COUNT(DISTINCT CASE WHEN pc.status != 'Cancelled' THEN pc.id END) AS total_classes,
			COUNT(DISTINCT CASE WHEN programs.archived_at IS NOT NULL THEN programs.id END) AS total_archived_classes,
			COUNT(DISTINCT CASE WHEN pcea.attendance_status IS NOT NULL THEN pcea.id END) AS total_attendances_marked,
			COUNT(DISTINCT CASE WHEN pcea.attendance_status = 'present' THEN pcea.id END) AS total_students_present
		`).
		Joins("LEFT JOIN program_classes pc ON pc.program_id = programs.id").
		Joins("LEFT JOIN facilities_programs fp ON fp.program_id = programs.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
		Joins("LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id").
		Group("programs.id, fp.facility_id")
	if err := tx.Scan(&histories).Error; err != nil {
		log.Errorln("error getting daily program facility history")
		return err
	}

	now := time.Now()
	for i := range histories {
		histories[i].Date = now
	}

	if len(histories) > 0 {
		if err := db.Create(&histories).Error; err != nil {
			log.Errorln("error creating daily program facility history")
			return err
		}
	}

	return nil
}
