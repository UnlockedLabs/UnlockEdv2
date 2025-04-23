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
	if err := db.WithContext(ctx).Model(&models.Program{}).
		Select(`
			COUNT(*) AS total_programs,
			SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) AS total_active_programs,
			SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS total_archived_programs
		`).
		Scan(&history).Error; err != nil {
		log.Errorln("error getting total, active, archived programs")
		return err
	}

	if err := db.WithContext(ctx).Model(&models.ProgramClassEnrollment{}).
		Select(`
			COUNT(*) AS total_enrollments,
			SUM(CASE WHEN enrollment_status = 'Completed' THEN 1 ELSE 0 END) AS total_completions
		`).
		Scan(&history).Error; err != nil {
		log.Errorln("error getting total, completed enrollments")
		return err
	}

	if err := db.WithContext(ctx).Model(&models.FacilitiesPrograms{}).
		Joins("JOIN programs ON programs.id = facilities_programs.program_id AND programs.is_active = true").
		Select("COUNT(*) AS total_program_offerings").
		Scan(&history).Error; err != nil {
		log.Errorln("error getting total program offerings")
		return err
	}

	if err := db.WithContext(ctx).Model(&models.Facility{}).
		Select("COUNT(*) AS total_facilities").
		Scan(&history).Error; err != nil {
		log.Errorln("error getting total facilities")
		return err
	}

	if err := db.WithContext(ctx).Model(&models.ProgramClassEventAttendance{}).
		Select(`SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END) AS total_students_present`).
		Scan(&history).Error; err != nil {
		log.Errorln("error getting total students present")
		return err
	}

	history.Date = time.Now()

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
			SUM(CASE WHEN programs.is_active = true THEN 1 ELSE 0 END) AS total_active_facilities,
			COUNT(pce.user_id) AS total_enrollments,
			SUM(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 ELSE 0 END) AS total_completions,
			SUM(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 ELSE 0 END) AS total_active_enrollments,
			SUM(CASE WHEN pc.status != 'Cancelled' THEN 1 ELSE 0 END) AS total_classes,
			SUM(CASE WHEN pc.status = 'Archived' THEN 1 ELSE 0 END) AS total_archived_classes,
			SUM(CASE WHEN pce.attendance_status = 'present' THEN 1 ELSE 0 END) AS total_students_present
		`).
		Joins("LEFT JOIN program_classes pc ON pc.program_id = programs.id").
		Joins("LEFT JOIN facilities_programs fp ON fp.program_id = programs.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
		Joins("LEFT JOIN program_types pt ON pt.program_id = programs.id").
		Joins("LEFT JOIN program_credit_types pct ON pct.program_id = programs.id").
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
			COUNT(pce.user_id) AS total_enrollments,
			SUM(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 ELSE 0 END) AS total_completions,
			SUM(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 ELSE 0 END) AS total_active_enrollments,
			SUM(CASE WHEN pc.status != 'Cancelled' THEN 1 ELSE 0 END) AS total_classes,
			SUM(CASE WHEN pc.status = 'Archived' THEN 1 ELSE 0 END) AS total_archived_classes,
			SUM(CASE WHEN pcea.attendance_status = 'present' THEN 1 ELSE 0 END) AS total_students_present
		`).
		Joins("LEFT JOIN program_classes pc ON pc.program_id = programs.id").
		Joins("LEFT JOIN facilities_programs fp ON fp.program_id = programs.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.class_id = pc.id").
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
