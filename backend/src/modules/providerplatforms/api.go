package providerplatforms

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"slices"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/providerplatforms/api"

	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// providerPlatformsAPI answers core's questions (api.ProviderPlatforms). The
// queries moved from core's database package unchanged (EN-193).
type providerPlatformsAPI struct{ accounts }

// NewAPI is Provider Platforms' answers to core, reading db.
func NewAPI(db *gorm.DB) api.ProviderPlatforms {
	return providerPlatformsAPI{accounts{store: &store{db: db}, client: &http.Client{}}}
}

// with is the api's store, reading with ctx.
func (a providerPlatformsAPI) with(ctx context.Context) *store {
	return &store{db: a.store.db.WithContext(ctx)}
}

func toAPIProvider(p *ProviderPlatform) api.Provider {
	return api.Provider{
		ID:        p.ID,
		Type:      p.Type,
		Name:      p.Name,
		BaseURL:   p.BaseUrl,
		AccountID: p.AccountID,
		AccessKey: p.AccessKey,
	}
}

func (a providerPlatformsAPI) Provider(ctx context.Context, id uint) (api.Provider, error) {
	provider, err := a.with(ctx).getProviderPlatformByID(int(id))
	if err != nil {
		return api.Provider{}, err
	}
	return toAPIProvider(provider), nil
}

func (a providerPlatformsAPI) ActiveProviders(ctx context.Context) ([]api.Provider, error) {
	providers, err := a.with(ctx).getAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	out := make([]api.Provider, len(providers))
	for i := range providers {
		out[i] = toAPIProvider(&providers[i])
	}
	return out, nil
}

func (a providerPlatformsAPI) UserMappings(ctx context.Context, userID uint) ([]api.Mapping, error) {
	mappings, err := a.with(ctx).getAllProviderMappingsForUser(int(userID))
	if err != nil {
		return nil, err
	}
	out := make([]api.Mapping, len(mappings))
	for i, m := range mappings {
		out[i] = api.Mapping{ProviderID: m.ProviderPlatformID, ExternalUserID: m.ExternalUserID}
	}
	return out, nil
}

func (a providerPlatformsAPI) MappedUserIDs(ctx context.Context, providerID uint) ([]uint, error) {
	var ids []uint
	err := a.store.db.WithContext(ctx).Model(&ProviderUserMapping{}).
		Where("provider_platform_id = ?", providerID).
		Pluck("user_id", &ids).Error
	return ids, err
}

func (a providerPlatformsAPI) DeleteUserMappings(ctx context.Context, userID uint) error {
	return a.store.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&ProviderUserMapping{}).Error
}

func (a providerPlatformsAPI) MappedUsers(ctx context.Context, providerID uint, externalUserIDs []string, facilityID uint) ([]api.MappedUser, error) {
	var rows []api.MappedUser
	q := a.store.db.WithContext(ctx).Model(&ProviderUserMapping{}).
		Select("provider_user_mappings.external_user_id, provider_user_mappings.user_id, users.name_first, users.name_last, users.doc_id").
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.deleted_at IS NULL", providerID, externalUserIDs)
	if facilityID != 0 {
		q = q.Where("users.facility_id = ?", facilityID)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (a providerPlatformsAPI) CountMapped(ctx context.Context, providerID uint, externalUserIDs []string) (int64, error) {
	var count int64
	err := a.store.db.WithContext(ctx).Model(&ProviderUserMapping{}).
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.deleted_at IS NULL", providerID, externalUserIDs).
		Count(&count).Error
	return count, err
}

func (a providerPlatformsAPI) CountMappedAtFacility(ctx context.Context, providerID uint, externalUserIDs []string, facilityID uint) (int64, error) {
	var count int64
	err := a.store.db.WithContext(ctx).Model(&ProviderUserMapping{}).
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.facility_id = ? AND users.deleted_at IS NULL",
			providerID, externalUserIDs, facilityID).
		Count(&count).Error
	return count, err
}

func (a providerPlatformsAPI) CountMappedPerFacility(ctx context.Context, providerID uint, externalUserIDs []string) (map[uint]int64, error) {
	type facilityCount struct {
		FacilityID uint  `gorm:"column:facility_id"`
		Count      int64 `gorm:"column:count"`
	}
	var rows []facilityCount
	if err := a.store.db.WithContext(ctx).Raw(`
		SELECT u.facility_id, COUNT(*) AS count
		FROM provider_user_mappings pum
		JOIN users u ON u.id = pum.user_id
		WHERE pum.provider_platform_id = ? AND pum.external_user_id IN ?
		  AND pum.deleted_at IS NULL AND u.deleted_at IS NULL
		GROUP BY u.facility_id
	`, providerID, externalUserIDs).Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[uint]int64, len(rows))
	for _, r := range rows {
		result[r.FacilityID] = r.Count
	}
	return result, nil
}

func (a providerPlatformsAPI) AddUserToProviders(ctx context.Context, user module.User, providerIDs []uint) error {
	for _, providerID := range providerIDs {
		provider, err := a.with(ctx).getProviderPlatformByID(int(providerID))
		if err != nil {
			return fmt.Errorf("get provider platform %d: %w", providerID, err)
		}
		if err := a.createAndRegisterProviderUserAccount(provider, user); err != nil {
			log.WithField("provider_id", providerID).Error("Error creating provider user account for provider: ", provider.Name)
		}
	}
	return nil
}

func (a providerPlatformsAPI) AddUserToKolibri(ctx context.Context, user module.User) error {
	kolibri, err := a.with(ctx).findKolibriInstance()
	if err != nil {
		return fmt.Errorf("get kolibri instance: %w", err)
	}
	return a.createUserInKolibri(user, kolibri)
}

func (a providerPlatformsAPI) SetupKolibri(ctx context.Context) error {
	fields := log.Fields{"func": "SetupKolibri"}
	if os.Getenv("KOLIBRI_URL") == "" {
		log.Println("no KOLIBRI_URL set, not registering new OIDC client")
		// there is no kolibri deployment registered
		return nil
	}
	provider, err := a.with(ctx).findKolibriInstance()
	if err != nil {
		provider = &ProviderPlatform{
			Name:      string(Kolibri),
			Type:      Kolibri,
			BaseUrl:   os.Getenv("KOLIBRI_URL"),
			AccessKey: os.Getenv("KOLIBRI_USERNAME") + ":" + os.Getenv("KOLIBRI_PASSWORD"),
			AccountID: "TODO", // kolibri wont be running yet. This will be updated the first time a user is added
			State:     Enabled,
		}
		err = a.store.createProviderPlatform(ctx, provider)
		if err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Errorln("error creating kolibri provider")
			return err
		}
	}
	client, _, err := OidcClientFromProvider(provider, false, a.client)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorln("error creating kolibri auth client")
		return err
	}
	return a.store.db.WithContext(ctx).Create(client).Error
}

func (a providerPlatformsAPI) LearningStats(ctx context.Context, facilityID *uint) (api.LearningStats, error) {
	db := a.store.db.WithContext(ctx)
	var stats api.LearningStats

	courses := db.Table("courses c").
		Select("COUNT(DISTINCT c.id) as total_courses_offered").
		Joins("INNER JOIN user_enrollments ue on c.id = ue.course_id").
		Joins("INNER JOIN users u on ue.user_id = u.id")
	if facilityID != nil {
		courses = courses.Where("u.facility_id = ?", facilityID)
	}
	if err := courses.Find(&stats.TotalCoursesOffered).Error; err != nil {
		return stats, fmt.Errorf("get total courses offered: %w", err)
	}

	students := db.Table("user_enrollments ue").
		Select("COUNT(DISTINCT ue.user_id) AS students_enrolled").
		Joins("INNER JOIN users u on ue.user_id = u.id")
	if facilityID != nil {
		students = students.Where("u.facility_id = ?", facilityID)
	}
	if err := students.Scan(&stats.TotalStudentsEnrolled).Error; err != nil {
		return stats, fmt.Errorf("get total students enrolled: %w", err)
	}

	activity := db.Table("activities a").
		Select("CAST(COALESCE(ROUND(SUM(a.time_delta)/3600, 0), 0) AS INTEGER) AS total_activity_time").
		Joins("INNER JOIN users u ON u.id = a.user_id")
	if facilityID != nil {
		activity = activity.Where("u.facility_id = ?", facilityID)
	}
	if err := activity.Scan(&stats.TotalHourlyActivity).Error; err != nil {
		return stats, fmt.Errorf("get total hourly activity: %w", err)
	}

	qry := `
	SELECT
	    sub.name AS course_name,
	    sub.completions AS total_students_completed,
	    sub.enrollments AS total_students_enrolled,
	    COALESCE(sub.activity_hours, 0) AS activity_hours,
	    CASE
	        WHEN COALESCE(sub.completions, 0) = 0 THEN 0
	        ELSE %s
	    END AS completion_rate
	FROM (
	    SELECT
	        c.id AS course_id,
	        c.name,
	        COUNT(DISTINCT ue.user_id) AS enrollments,
	        (SELECT COUNT(DISTINCT o.user_id) FROM outcomes o WHERE o.course_id = c.id) AS completions,
	        (SELECT ROUND(COALESCE(SUM(a.time_delta) / 3600, 0), 2)
	         FROM activities a WHERE a.course_id = c.id) AS activity_hours
	    FROM courses c
	    LEFT JOIN user_enrollments ue ON ue.course_id = c.id
	    GROUP BY c.id, c.name
	) AS sub
	ORDER BY sub.course_id
`
	sqlFunc := `ROUND(COALESCE(sub.completions, 0)::NUMERIC / COALESCE(sub.enrollments, 0) * 100, 2)`

	if db.Name() == "sqlite" {
		sqlFunc = `ROUND(CAST(COALESCE(sub.completions, 0) AS REAL) /
               CAST(NULLIF(sub.enrollments, 0) AS REAL) * 100, 2)`
	}

	if err := db.Raw(fmt.Sprintf(qry, sqlFunc)).Find(&stats.Insights).Error; err != nil {
		return stats, fmt.Errorf("get learning insights: %w", err)
	}
	return stats, nil
}

// seededActivity marks the first activity of each demo seed.
const seededActivity = "SEEDED_ACTIVITY"

func (a providerPlatformsAPI) LastDemoSeed(ctx context.Context) (time.Time, bool, error) {
	activity := Activity{}
	err := a.store.db.WithContext(ctx).Model(&Activity{}).Where("external_id = ?", seededActivity).Order("created_at desc").First(&activity).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return activity.UpdatedAt, true, nil
}

func (a providerPlatformsAPI) ResetDemoLearning(ctx context.Context, through time.Time) error {
	db := a.store.db.WithContext(ctx)
	if err := db.Exec("DELETE from user_course_activity_totals where date(last_ts) <= date(?)", through).Error; err != nil {
		return fmt.Errorf("delete user_course_activity_totals: %w", err)
	}
	if err := db.Exec("DELETE from activities where date(created_at) <= date(?)", through).Error; err != nil {
		return fmt.Errorf("delete activities: %w", err)
	}
	if err := db.Exec("DELETE from milestones where date(created_at) <= date(?)", through).Error; err != nil {
		return fmt.Errorf("delete milestones: %w", err)
	}
	if err := db.Exec("DELETE from outcomes where date(created_at) <= date(?)", through).Error; err != nil {
		return fmt.Errorf("delete outcomes: %w", err)
	}
	return nil
}

func (a providerPlatformsAPI) SeedDemoLearning(ctx context.Context, userIDs []uint) error {
	db := a.store.db.WithContext(ctx)
	var enrollments []UserEnrollment
	if err := db.Where("user_id IN ?", userIDs).Find(&enrollments).Error; err != nil {
		return fmt.Errorf("get user enrollments: %w", err)
	}

	//just update courses total progress where they are equal to 0
	if err := db.Model(&Course{}).Where("total_progress_milestones = 0").Update("total_progress_milestones", 40).Error; err != nil {
		log.Infof("no courses needed to be updated") //just logging the message
	}

	courses := []Course{}
	if err := db.Preload("ProviderPlatform").Find(&courses).Error; err != nil {
		return fmt.Errorf("get courses: %w", err)
	}

	outcomes := []string{"college_credit", "grade", "certificate", "pathway_completion"}
	completedNumCount := 0
	sixMonthsAgo := time.Now().AddDate(0, -6, 0)
	for _, userID := range userIDs {
		enrolledCourses := randomSubset(courses, len(courses)/2)
		for _, course := range enrolledCourses {
			startDate := course.StartDt
			if startDate == nil {
				startDate = &sixMonthsAgo
			}
			if !slices.ContainsFunc(enrollments, func(e UserEnrollment) bool {
				return e.UserID == userID && e.CourseID == course.ID
			}) {
				if err := db.Exec("INSERT INTO user_enrollments (user_id, course_id, external_id, created_at) VALUES (?, ?, ?, ?)",
					userID, course.ID, uuid.NewString(), startDate).Error; err != nil {
					log.Println(err)
				}
			}
			daysSinceStart := int(time.Since(*startDate).Hours() / 24)
			backThen := time.Now().AddDate(0, 0, -daysSinceStart)
			milestonesPerUser := 0
			totalCourseTime := int64(0)

			for day := 0; day < daysSinceStart; day++ {
				randTime := rand.Int63n(5000)
				externalID := uuid.NewString()
				if day == 0 {
					externalID = seededActivity
				}
				createdAt := backThen.AddDate(0, 0, day)
				if course.ProviderPlatform == nil {
					continue
				}
				sqlStr := ""
				var timeToEnter int64
				switch course.ProviderPlatform.Type {
				case Kolibri:
					sqlStr = "CALL insert_daily_activity_kolibri(?, ?, ?, ?, ?, ?)"
					timeToEnter = randTime
				case CanvasCloud, CanvasOSS:
					sqlStr = "CALL insert_daily_activity_canvas(?, ?, ?, ?, ?, ?)"
					timeToEnter = totalCourseTime
				default:
					continue
				}
				if err := db.Exec(sqlStr, userID, course.ID, ContentInteraction, timeToEnter, externalID, createdAt).
					Error; err != nil {
					continue
				}
				totalCourseTime += randTime

				if day%8 == 0 && uint(milestonesPerUser) < course.TotalProgressMilestones {
					milestone := Milestone{
						UserID: userID, CourseID: course.ID, ExternalID: uuid.NewString(),
						Type: AssignmentSubmission, IsCompleted: rand.Intn(2) == 0,
					}
					milestone.CreatedAt = createdAt
					if err := db.Create(&milestone).Error; err != nil {
						continue
					}
					milestonesPerUser++
					if uint(milestonesPerUser) == course.TotalProgressMilestones && completedNumCount != 3 {
						//add outcome here
						outcome := Outcome{
							UserID:   userID,
							CourseID: course.ID,
							Type:     OutcomeType(outcomes[rand.Intn(len(outcomes))]),
						}
						outcome.CreatedAt = createdAt
						if err := db.Create(&outcome).Error; err != nil {
							continue
						}
						completedNumCount++
					}
				}
			}
		}
	}

	return nil
}

func randomSubset[T any](items []T, size int) []T {
	if size >= len(items) {
		return items
	}
	shuffled := make([]T, len(items))
	copy(shuffled, items)
	rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	return shuffled[:size]
}
