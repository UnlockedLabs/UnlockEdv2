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

func (db *DB) GetSecondProgramEnrollmentRates(args *models.QueryContext, facilityID *uint) ([]models.SecondProgramEnrollmentRow, error) {
	type enrollmentRow struct {
		UserID            uint
		FacilityID        uint
		FacilityName      string
		ProgramID         uint
		Status            models.ProgramEnrollmentStatus
		EnrolledAt        *time.Time
		EnrollmentEndedAt *time.Time
	}
	rows := make([]enrollmentRow, 0)
	tx := db.WithContext(args.Ctx).Table("program_class_enrollments pce").
		Select("pce.user_id, pc.facility_id, f.name as facility_name, pc.program_id, pce.enrollment_status as status, pce.enrolled_at, pce.enrollment_ended_at").
		Joins("JOIN program_class_cohorts pc ON pc.id = pce.cohort_id").
		Joins("JOIN facilities f ON f.id = pc.facility_id")
	if facilityID != nil {
		tx = tx.Where("pc.facility_id = ?", *facilityID)
	}
	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}

	programTypeByID, err := db.programTypeLabelsByProgramID(args)
	if err != nil {
		return nil, err
	}

	type userEnrollment struct {
		facilityID   uint
		facilityName string
		programID    uint
		status       models.ProgramEnrollmentStatus
		enrolledAt   *time.Time
		endedAt      *time.Time
	}
	byUser := make(map[uint][]userEnrollment)
	for _, row := range rows {
		byUser[row.UserID] = append(byUser[row.UserID], userEnrollment{
			facilityID: row.FacilityID, facilityName: row.FacilityName, programID: row.ProgramID,
			status: row.Status, enrolledAt: row.EnrolledAt, endedAt: row.EnrollmentEndedAt,
		})
	}

	type key struct {
		facilityName string
		programType  string
	}
	completedFirst := make(map[key]int64)
	enrolledSecond := make(map[key]int64)

	for _, enrollments := range byUser {
		// Find this user's earliest completion by EnrollmentEndedAt.
		var first *userEnrollment
		for i := range enrollments {
			e := &enrollments[i]
			if e.status != models.EnrollmentCompleted || e.endedAt == nil {
				continue
			}
			if first == nil || e.endedAt.Before(*first.endedAt) {
				first = e
			}
		}
		if first == nil {
			continue
		}
		k := key{facilityName: first.facilityName, programType: programTypeByID[first.programID]}
		completedFirst[k]++

		for _, e := range enrollments {
			if e.programID == first.programID && e.status == models.EnrollmentCompleted {
				continue // this is the "first completion" itself, not a second enrollment
			}
			if e.enrolledAt != nil && e.enrolledAt.After(*first.endedAt) {
				enrolledSecond[k]++
				break
			}
		}
	}

	result := make([]models.SecondProgramEnrollmentRow, 0, len(completedFirst))
	for k, completed := range completedFirst {
		second := enrolledSecond[k]
		result = append(result, models.SecondProgramEnrollmentRow{
			FacilityName:   k.facilityName,
			ProgramType:    k.programType,
			CompletedFirst: completed,
			EnrolledSecond: second,
			Rate:           float64(second) / float64(completed) * 100,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Rate > result[j].Rate
	})
	return result, nil
}

// programTypeLabel returns a deterministic single label for a program that
// may have multiple attached ProgramTypes: alphabetically first. Most
// programs have exactly one type; this is a pragmatic tie-break, not a bug.
func programTypeLabel(types []models.ProgramType) string {
	if len(types) == 0 {
		return "Other"
	}
	labels := make([]string, 0, len(types))
	for _, t := range types {
		labels = append(labels, t.ProgramType.HumanReadable())
	}
	sort.Strings(labels)
	return labels[0]
}

// programTypeLabelsByProgramID returns each program's deterministic type
// label (see programTypeLabel), keyed by program ID.
func (db *DB) programTypeLabelsByProgramID(args *models.QueryContext) (map[uint]string, error) {
	var programs []models.Program
	if err := db.WithContext(args.Ctx).Preload("ProgramTypes").Find(&programs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	labels := make(map[uint]string, len(programs))
	for _, p := range programs {
		labels[p.ID] = programTypeLabel(p.ProgramTypes)
	}
	return labels, nil
}
