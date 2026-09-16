package database

import (
	"UnlockEdv2/src/models"
	"sort"
	"time"

	"gorm.io/gorm"
)

const minEnrolleesForRanking = 5

func (db *DB) piResidentScope(args *models.QueryContext, facilityID *uint) *gorm.DB {
	tx := db.WithContext(args.Ctx).Model(&models.User{}).
		Where("role = ? AND deactivated_at IS NULL", models.Student)
	if facilityID != nil {
		tx = tx.Where("facility_id = ?", *facilityID)
	}
	return tx
}

// piEnrollmentResidentScope scopes program_class_enrollments to rows belonging
// to active, resident (Student) users, optionally within one facility. Shared
// base for the active-residents and ever-enrolled-residents counts, which
// differ only in their enrollment-status filter.
func (db *DB) piEnrollmentResidentScope(args *models.QueryContext, facilityID *uint) *gorm.DB {
	tx := db.WithContext(args.Ctx).Table("program_class_enrollments pce").
		Joins("JOIN users u ON u.id = pce.user_id").
		Where("u.role = ? AND u.deactivated_at IS NULL", models.Student)
	if facilityID != nil {
		tx = tx.Where("u.facility_id = ?", *facilityID)
	}
	return tx
}

func (db *DB) GetProgramEngagementOverview(args *models.QueryContext, start, end *time.Time, facilityID *uint) (models.ProgramEngagementOverview, error) {
	var overview models.ProgramEngagementOverview

	if err := db.piResidentScope(args, facilityID).Count(&overview.TotalResidents).Error; err != nil {
		return overview, newGetRecordsDBError(err, "users")
	}

	activeTx := db.piEnrollmentResidentScope(args, facilityID).
		Where("pce.enrollment_status = ? AND pce.enrollment_ended_at IS NULL", models.Enrolled)
	if err := activeTx.Distinct("pce.user_id").Count(&overview.ActiveResidents).Error; err != nil {
		return overview, newGetRecordsDBError(err, "program_class_enrollments")
	}

	var everEnrolledCount int64
	everTx := db.piEnrollmentResidentScope(args, facilityID)
	if err := everTx.Distinct("pce.user_id").Count(&everEnrolledCount).Error; err != nil {
		return overview, newGetRecordsDBError(err, "program_class_enrollments")
	}
	overview.NeverEngagedResidents = overview.TotalResidents - everEnrolledCount
	if overview.NeverEngagedResidents < 0 {
		overview.NeverEngagedResidents = 0
	}

	type progRow struct {
		ProgramID   uint
		ProgramName string
		Status      models.ProgramEnrollmentStatus
		EnrolledAt  *time.Time
	}
	rows := make([]progRow, 0)
	rowsTx := db.WithContext(args.Ctx).Table("program_class_enrollments pce").
		Select("p.id as program_id, p.name as program_name, pce.enrollment_status as status, pce.enrolled_at").
		Joins("JOIN program_class_cohorts pc ON pc.id = pce.cohort_id").
		Joins("JOIN programs p ON p.id = pc.program_id").
		Where("pce.enrolled_at IS NOT NULL")
	if facilityID != nil {
		rowsTx = rowsTx.Where("pc.facility_id = ?", *facilityID)
	}
	if start != nil && end != nil {
		rowsTx = rowsTx.Where("pce.enrolled_at >= ? AND pce.enrolled_at < ?", *start, *end)
	}
	if err := rowsTx.Scan(&rows).Error; err != nil {
		return overview, newGetRecordsDBError(err, "program_class_enrollments")
	}

	type progAgg struct {
		name      string
		enrolled  int64
		completed int64
	}
	aggByID := make(map[uint]*progAgg)
	order := make([]uint, 0)
	for _, row := range rows {
		agg, ok := aggByID[row.ProgramID]
		if !ok {
			agg = &progAgg{name: row.ProgramName}
			aggByID[row.ProgramID] = agg
			order = append(order, row.ProgramID)
		}
		agg.enrolled++
		if row.Status == models.EnrollmentCompleted {
			agg.completed++
		}
	}

	ranked := make([]models.ProgramCompletionRank, 0)
	for _, id := range order {
		agg := aggByID[id]
		if agg.enrolled < minEnrolleesForRanking {
			continue
		}
		ranked = append(ranked, models.ProgramCompletionRank{
			ProgramName:    agg.name,
			Enrolled:       agg.enrolled,
			Completed:      agg.completed,
			CompletionRate: float64(agg.completed) / float64(agg.enrolled) * 100,
		})
	}
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].CompletionRate > ranked[j].CompletionRate
	})
	overview.TopPrograms = ranked

	return overview, nil
}
