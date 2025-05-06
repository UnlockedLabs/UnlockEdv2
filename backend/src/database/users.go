package database

import (
	"UnlockEdv2/src/models"
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func calcOffset(page, perPage int) int {
	return (page - 1) * perPage
}

func (db *DB) GetCurrentUsers(args *models.QueryContext, role string) ([]models.User, error) {
	tx := db.WithContext(args.Ctx).Model(&models.User{}).Where("facility_id = ?", args.FacilityID)
	switch role {
	case "system_admin":
		tx = tx.Where("role IN ('system_admin',  'department_admin', 'facility_admin')")
	case "department_admin":
		tx = tx.Where("role IN ('department_admin', 'facility_admin')")
	case "facility_admin":
		tx = tx.Where("role = 'facility_admin'")
	case "student":
		tx = tx.Where("role = 'student'")
	}
	if args.Search != "" {
		tx = fuzzySearchUsers(tx, args)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "users")
	}
	users := make([]models.User, 0, args.PerPage)
	if err := tx.Order(args.OrderClause()).
		Offset(args.CalcOffset()).
		Limit(args.PerPage).
		Find(&users).
		Error; err != nil {
		log.Errorf("Error fetching users: %v", err)
		return nil, newGetRecordsDBError(err, "users")
	}
	return users, nil
}

func (db *DB) GetUserByDocIDAndID(ctx context.Context, docID string, userID int) (*models.User, error) {
	user := models.User{}
	if err := db.WithContext(ctx).First(&user, "LOWER(doc_id) = ? and id = ?", strings.ToLower(docID), userID).Error; err != nil {
		return nil, newNotFoundDBError(err, "users")
	}
	return &user, nil
}

func (db *DB) GetUsersByIDs(userIDs []uint, args *models.QueryContext) ([]models.User, error) {
	users := make([]models.User, 0, len(userIDs))
	if err := db.WithContext(args.Ctx).Find(&users).Where("id IN (?)", userIDs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "users")
	}
	return users, nil
}

func (db *DB) GetTransferProgramConflicts(ctx context.Context, id uint, transferFacilityId int) ([]string, error) {
	var programNames []string
	query := `with transfer_facility_programs as (
			select name from programs p
			inner join facilities_programs fp on fp.program_id = p.id
					and fp.facility_id = ?
			where p.is_active = true
		)
		select pc.name from program_class_enrollments pce
		inner join users u on u.id = pce.user_id
			and u.id = ?
		inner join program_classes pc on pc.id = pce.class_id
			and pc.facility_id = u.facility_id
		inner join programs p on p.id = pc.program_id
		where enrollment_status = 'Enrolled'
			and pc.name not in (select name from transfer_facility_programs)`
	if err := db.WithContext(ctx).Raw(query, transferFacilityId, id).Scan(&programNames).Error; err != nil {
		return nil, err
	}
	return programNames, nil
}

func (db *DB) TransferResident(ctx *models.QueryContext, userID int, currFacilityID int, transFacilityID int) (*gorm.DB, error) {
	trans := db.Begin()
	if trans.Error != nil {
		return nil, NewDBError(trans.Error, "unable to start DB transaction")
	}
	updateQuery := `UPDATE program_class_enrollments AS pce SET enrollment_status = ?
		FROM program_classes pc
		WHERE pce.class_id = pc.id
			AND pce.user_id = ?
			AND pc.facility_id = ?
			AND pce.enrollment_status = 'Enrolled'`

	if err := trans.Exec(updateQuery, "Incomplete: Transferred", userID, currFacilityID).Error; err != nil {
		trans.Rollback()
		return nil, newUpdateDBError(err, "program_class_enrollments")
	}
	if err := trans.Model(&models.User{}).
		Where("id = ?", userID).
		Update("facility_id", transFacilityID).Error; err != nil {
		trans.Rollback()
		return nil, newUpdateDBError(err, "users")
	}
	return trans, nil
}

func (db *DB) GetEligibleResidentsForClass(args *models.QueryContext, classId int) ([]models.User, error) {
	tx := db.WithContext(args.Ctx).Model(&models.User{}).
		Joins("LEFT JOIN program_class_enrollments pse ON users.id = pse.user_id AND pse.class_id = ?", classId).
		Joins("JOIN facilities_programs fp ON users.facility_id = fp.facility_id").
		Joins("JOIN program_classes c ON c.program_id = fp.program_id AND c.id = ?", classId).
		Where("pse.user_id IS NULL"). //not enrolled in class
		Where("users.role = 'student' AND users.facility_id = ?", args.FacilityID)

	if args.SearchQuery() != "" {
		tx = fuzzySearchUsers(tx, args)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "users")
	}
	users := make([]models.User, 0, args.PerPage)
	if err := tx.Order(args.OrderClause()).
		Offset(args.CalcOffset()).
		Limit(args.PerPage).
		Find(&users).
		Error; err != nil {
		return nil, newGetRecordsDBError(err, "users")
	}
	return users, nil
}

// This function takes an existing transaction and applies proper searching through first, last, username + doc_id
func fuzzySearchUsers(tx *gorm.DB, ctx *models.QueryContext) *gorm.DB {
	likeSearch := ctx.SearchQuery()
	_, err := strconv.Atoi(ctx.Search)
	if err == nil {
		// optimization if a number is entered, they are searching for their DOC#
		tx = tx.Where("LOWER(doc_id) LIKE ?", likeSearch)
	} else {
		tx = tx.Where(`(? <% concat_ws(' ', name_first, name_last, username)
				OR concat_ws(' ', name_first, name_last, username, doc_id) ILIKE ?)`,
			likeSearch, likeSearch)
	}
	return tx
}

func (db *DB) GetUserByID(id uint) (*models.User, error) {
	user := models.User{}
	if err := db.First(&user, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "users")
	}
	return &user, nil
}

func (db *DB) GetSystemAdmin() (*models.User, error) {
	user := models.User{}
	if err := db.First(&user, "role = 'system_admin'").Error; err != nil {
		return nil, newNotFoundDBError(err, "system admin")
	}
	return &user, nil
}

func (db *DB) CreateUser(user *models.User) error {
	err := Validate().Struct(user)
	if err != nil {
		return NewDBError(err, "user")
	}
	error := db.Create(user).Error
	if error != nil {
		return newCreateDBError(error, "users")
	}
	return nil
}

func (db *DB) DeleteUser(id int) error {
	result := db.Model(&models.User{}).Where("id = ?", id).Delete(&models.User{})
	if result.Error != nil {
		return newDeleteDBError(result.Error, "users")
	}
	if result.RowsAffected == 0 {
		return newDeleteDBError(gorm.ErrRecordNotFound, "users")
	}
	return nil
}

func (db *DB) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	if err := db.Model(models.User{}).First(&user, "username = ?", username).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) UsernameExists(username string) bool {
	userExists := false
	email := username + "@unlocked.v2"
	if err := db.Raw("SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = ? OR email = ?)", strings.ToLower(username), email).
		Scan(&userExists).Error; err != nil {
		log.Error("Error checking if username exists: ", err)
	}
	return userExists
}

func (db *DB) UpdateUser(user *models.User) error {
	if user.ID == 0 {
		return newUpdateDBError(errors.New("invalid user ID"), "users")
	}
	err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(user).Error
	if err != nil {
		return newUpdateDBError(err, "users")
	}
	return nil
}

func (db *DB) ToggleProgramFavorite(user_id uint, id uint) (bool, error) {
	var favRemoved bool
	var favorite models.ProgramFavorite
	if db.First(&favorite, "user_id = ? AND program_id = ?", user_id, id).RowsAffected > 0 {
		if err := db.Unscoped().Delete(&favorite).Error; err != nil {
			return favRemoved, newDeleteDBError(err, "favorites")
		}
		favRemoved = true
	} else {
		if err := db.Create(&models.ProgramFavorite{UserID: user_id, ProgramID: id}).Error; err != nil {
			return favRemoved, newCreateDBError(err, "error creating favorites")
		}
	}
	return favRemoved, nil
}

func (db *DB) IncrementUserLogin(user *models.User) (int64, error) {
	if err := db.Exec(
		`INSERT INTO login_metrics (user_id, total, last_login) 
		 VALUES (?, 1, CURRENT_TIMESTAMP) 
		 ON CONFLICT (user_id) DO UPDATE 
		 SET total = login_metrics.total + 1, last_login = CURRENT_TIMESTAMP`,
		user.ID).Error; err != nil {
		log.Errorf("Error incrementing login count: %v", err)
		return 0, newUpdateDBError(err, "login_metrics")
	}
	now := time.Now()
	rounded := now.Truncate(time.Hour)

	if err := db.Exec(
		`INSERT INTO login_activity (time_interval, facility_id, total_logins)
		 VALUES (?, ?, ?)
		 ON CONFLICT (time_interval, facility_id)
		 DO UPDATE SET total_logins = login_activity.total_logins + 1`,
		rounded, user.FacilityID, 1).Error; err != nil {
		log.Errorf("Error incrementing login activity: %v", err)
		return 0, newUpdateDBError(err, "login_activity")
	}

	var count int64
	err := db.Model(&models.LoginMetrics{}).Select("total").Where("user_id = ?", user.ID).Scan(&count).Error
	if err != nil {
		log.Errorf("Error counting login metrics: %v", err)
		return 0, newGetRecordsDBError(err, "login_metrics")
	}
	return count, nil
}

func (db *DB) LogUserSessionStarted(userID uint, sessionID string) {
	if db.Where("user_id = ? and session_id = ?", userID, sessionID).First(&models.UserSessionTracking{}).RowsAffected > 0 {
		log.Warn("The record already exists skipping the log in activity")
		return
	}

	userTracking := models.UserSessionTracking{
		UserID:         userID,
		SessionStartTS: time.Now(),
		SessionID:      sessionID,
	}
	if err := db.Create(&userTracking).Error; err != nil {
		log.Warnf("Unable to insert user for session tracking: %v", err)
	}
}

func (db *DB) LogUserSessionEnded(userID uint, sessionID string) {
	var userSessionTracking models.UserSessionTracking
	if err := db.Where("user_id = ? and session_id = ?", userID, sessionID).Order("session_start_ts desc").First(&userSessionTracking).Error; err != nil {
		log.Warnf("Unable to find user record to update user for session tracking: %v", err)
	}

	if err := db.Model(&userSessionTracking).Update("session_end_ts", time.Now()).Error; err != nil {
		log.Warnf("Unable to update user for session tracking: %v", err)
	}
}

func (db *DB) GetNumberOfActiveUsersForTimePeriod(args *models.QueryContext, active bool, days int, facilityId *uint) (int64, error) {
	var count int64
	var tx *gorm.DB
	join := "JOIN login_metrics on users.id = login_metrics.user_id"
	tx = db.WithContext(args.Ctx).Model(&models.User{})
	if days == -1 {
		tx = tx.Joins(join)
	} else {
		daysAgo := time.Now().AddDate(0, 0, -days)
		if active {
			join += " AND login_metrics.last_login > ?"
		} else {
			join += " AND login_metrics.last_login < ?"
		}
		tx = tx.Joins(join, daysAgo)
	}
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "users")
	}
	return count, nil
}

func (db *DB) NewUsersInTimePeriod(args *models.QueryContext, days int, facilityId *uint) (int64, int64, error) {
	var admin_count int64
	var resident_count int64
	daysAgo := time.Now().AddDate(0, 0, -days)
	tx := db.WithContext(args.Ctx).Model(&models.User{}).Where("role ='student'")
	if days != -1 {
		tx = tx.Where("created_at >= ?", daysAgo)
	}
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&resident_count).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	tx = db.WithContext(args.Ctx).Model(&models.User{}).Where("role IN ?", models.AdminRoles)
	if days != -1 {
		tx = tx.Where("created_at >= ?", daysAgo)
	}
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&admin_count).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	return resident_count, admin_count, nil
}

func (db *DB) GetTotalLogins(args *models.QueryContext, days int, facilityId *uint) (int64, error) {
	var total int64
	tx := db.WithContext(args.Ctx).Model(&models.LoginActivity{}).Select("SUM(total_logins)")
	if days != -1 {
		daysAgo := time.Now().AddDate(0, 0, -days)
		tx = tx.Where("time_interval >= ?", daysAgo)
	}
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Scan(&total).Error; err != nil {
		return 0, newGetRecordsDBError(err, "login_activity")
	}
	return total, nil
}

func (db *DB) GetTotalUsers(args *models.QueryContext, facilityId *uint) (int64, int64, error) {
	var totalResidents int64
	var totalAdmins int64
	tx := db.WithContext(args.Ctx).Model(&models.User{}).Where("role = 'student'")
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&totalResidents).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	tx = db.WithContext(args.Ctx).Model(&models.User{}).Where("role IN ?", models.AdminRoles)
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&totalAdmins).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	return totalResidents, totalAdmins, nil
}

func (db *DB) GetLoginActivity(args *models.QueryContext, days int, facilityID *uint) ([]models.LoginActivity, error) {
	acitvity := make([]models.LoginActivity, 0, 3)
	var query *gorm.DB
	if days == -1 {
		query = db.WithContext(args.Ctx).Raw(`SELECT time_interval, total_logins
						FROM login_activity
						ORDER BY total_logins DESC
						LIMIT 3;`)
	} else {
		daysAgo := time.Now().AddDate(0, 0, -days)
		query = db.WithContext(args.Ctx).Raw(`SELECT time_interval, total_logins
						FROM login_activity
						WHERE time_interval >= ?
						ORDER BY total_logins DESC
						LIMIT 3;`, daysAgo)
	}
	if err := query.Scan(&acitvity).Error; err != nil {
		return nil, newGetRecordsDBError(err, "login_activity")
	}
	return acitvity, nil
}

func (db *DB) GetUserSessionEngagement(userID int, days int) ([]models.SessionEngagement, error) {
	var sessionEngagement []models.SessionEngagement

	daysAgo := time.Now().AddDate(0, 0, -days)

	query := db.Table("user_session_tracking as ust").
		Select(`ust.user_id,
	TO_CHAR(DATE(ust.session_start_ts), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS time_interval,
	SUM(EXTRACT(EPOCH FROM ust.session_duration) / 3600) AS total_hours,
	SUM(EXTRACT(EPOCH FROM ust.session_duration) / 60) AS total_minutes`).
		Joins("JOIN users u ON ust.user_id = u.id").
		Where("ust.user_id = ? AND ust.session_start_ts >= ?", userID, daysAgo).
		Group("ust.user_id, time_interval").
		Order("ust.user_id, time_interval")

	if err := query.Find(&sessionEngagement).Error; err != nil {
		return nil, newGetRecordsDBError(err, "session_engagement")
	}
	var user models.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, newNotFoundDBError(err, "users")
	}

	return sessionEngagement, nil
}

func (db *DB) GetUserOpenContentEngagement(userID int) (*models.EngagementActivityMetrics, error) {
	var engagementActivityMetrics models.EngagementActivityMetrics
	query := db.Table("users u").
		Select(`u.id as user_id,
		COUNT(DISTINCT CAST(oca.request_ts AS DATE)) AS total_active_days_monthly,
		AVG(EXTRACT(EPOCH FROM (oca.stop_ts - oca.request_ts)) / 3600) AS total_hours_active_monthly,
		SUM(EXTRACT(EPOCH FROM (oca.stop_ts - oca.request_ts)) / 3600) / 4 AS total_hours_active_weekly,
		SUM(EXTRACT(EPOCH FROM (oca.stop_ts - oca.request_ts)) / 60) / 4 AS total_minutes_active_weekly,
		SUM(
			CASE
				WHEN oca.request_ts >= date_trunc('week', CURRENT_DATE)
				THEN EXTRACT(EPOCH FROM (oca.stop_ts - oca.request_ts)) / 3600
				ELSE 0
			END
		) AS total_hours_engaged,
		SUM(
			CASE
				WHEN oca.request_ts >= date_trunc('week', CURRENT_DATE)
				THEN EXTRACT(EPOCH FROM (oca.stop_ts - oca.request_ts)) / 60
				ELSE 0
			END
		) AS total_minutes_engaged,
		COALESCE(l.last_login, NULL) AS last_active_date,
		u.created_at as joined`).
		Joins("LEFT JOIN login_metrics l ON l.user_id = u.id").
		Joins("LEFT JOIN open_content_activities oca ON oca.user_id = u.id").
		Where("u.id = ?", userID).
		Group("u.id, l.last_login, u.created_at")

	if err := query.Find(&engagementActivityMetrics).Error; err != nil {
		return nil, NewDBError(err, "error getting engagement_activity")
	}
	return &engagementActivityMetrics, nil
}

func (db *DB) IncrementUserFAQClick(args *models.QueryContext, question string) error {
	faq := models.FAQ{Question: question}
	if err := db.WithContext(args.Ctx).Model(&models.FAQ{}).Where("LOWER(question) = ?", strings.ToLower(question)).FirstOrCreate(&faq).Error; err != nil {
		log.Errorf("failed to find or create FAQ: %v", err)
		return newUpdateDBError(err, "faqs")
	}
	if err := db.WithContext(args.Ctx).Exec(`INSERT INTO faq_click_metrics(user_id, faq_id, total) VALUES (?, ?, 1) 
		 ON CONFLICT (user_id, faq_id) DO UPDATE SET total = faq_click_metrics.total + 1`,
		args.UserID, faq.ID).Error; err != nil {
		log.Errorf("Error incrementing faq clicks: %v", err)
		return newUpdateDBError(err, "faq_click_metrics")
	}
	return nil
}

func (db *DB) InsertUserAccountHistoryAction(ctx context.Context, accountHistory *models.UserAccountHistory) error {
	if err := db.WithContext(ctx).Create(&accountHistory).Error; err != nil {
		log.Errorf("Error inserting user account history action: %v", err)
		return newCreateDBError(err, "user_account_history")
	}
	return nil
}

func (db *DB) GetUserAccountHistory(args *models.QueryContext, userID uint) ([]models.ActivityHistoryResponse, error) {
	history := make([]models.ActivityHistoryResponse, 0, args.PerPage)
	tx := db.WithContext(args.Ctx).
		Table("user_account_history uah").
		Select(`uah.action, uah.created_at, uah.user_id, 
				users.username AS user_username, 
				admins.username AS admin_username, 
				facilities.name AS facility_name, 
				psh.*`).
		Joins("INNER JOIN users ON uah.user_id = users.id").
		Joins("LEFT JOIN users admins ON uah.admin_id = admins.id").
		Joins("LEFT JOIN facilities ON uah.facility_id = facilities.id").
		Joins("LEFT JOIN program_classes_history psh ON uah.program_classes_history_id = psh.id").
		Where("uah.user_id = ?", userID)
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "user_account_history")
	}
	if err := tx.Order("uah.created_at desc").
		Offset(args.CalcOffset()).
		Limit(args.PerPage).
		Scan(&history).Error; err != nil {
		return nil, newGetRecordsDBError(err, "user_account_history")
	}
	return history, nil
}

func (db *DB) GetUserProgramInfo(args *models.QueryContext, userId int) ([]models.ResidentProgramClassInfo, error) {
	userEnrollments := make([]models.ResidentProgramClassInfo, 0, args.PerPage)
	base := db.WithContext(args.Ctx).
		Table("program_class_enrollments AS pce").
		Select(`
            pce.enrollment_status   AS enrollment_status,
            p.name                   AS program_name,
            p.id                     AS program_id,
            pc.name                  AS class_name,
            pc.status                AS status,
            pc.start_dt              AS start_date,
            pc.end_dt                AS end_date,
            pc.id                    AS class_id,

            -- count present attendance status
            COALESCE(SUM(
              CASE WHEN pcea.attendance_status = 'present' THEN 1 ELSE 0 END
            ), 0) AS present_attendance,

            -- count everything else as absent
            COALESCE(SUM(
              CASE WHEN pcea.attendance_status <> 'present' THEN 1 ELSE 0 END
            ), 0)  AS absent_attendance
        `).
		Joins("INNER JOIN program_classes pc  ON pc.id  = pce.class_id").
		Joins("INNER JOIN programs         p   ON p.id   = pc.program_id").
		Joins("INNER JOIN program_class_events e   ON e.class_id = pc.id").
		Joins(`LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = e.id AND pcea.user_id = ?`, userId).
		Where("pce.user_id = ?", userId).
		Group(`
            pce.enrollment_status,
            p.name, p.id,
            pc.name, pc.status, pc.start_dt, pc.end_dt, pc.id
        `).
		Order("pc.start_dt DESC")

	if err := base.Count(&args.Total).Error; err != nil {
		return nil, NewDBError(err, "program_class_enrollments")
	}
	if err := base.Limit(args.PerPage).Offset(args.CalcOffset()).Scan(&userEnrollments).Error; err != nil {
		return nil, NewDBError(err, "program_class_enrollments apply pagination")
	}

	return userEnrollments, nil
}
