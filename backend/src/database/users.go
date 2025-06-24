package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func calcOffset(page, perPage int) int {
	return (page - 1) * perPage
}

func (db *DB) GetCurrentUsers(args *models.QueryContext, role string) ([]models.User, error) {
	if args.Search != "" {
		return db.SearchCurrentUsers(args, role)
	}
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

func (db *DB) SearchCurrentUsers(ctx *models.QueryContext, role string) ([]models.User, error) {
	likeSearch := ctx.SearchQuery()
	tx := db.WithContext(ctx.Ctx).Model(&models.User{}).Where("facility_id = ?", ctx.FacilityID)
	switch role {
	case "admin":
		tx = tx.Where("role IN ('admin', 'system_admin')")
	case "student":
		tx = tx.Where("role = 'student'")
	}
	tx = tx.Where("LOWER(name_first) LIKE ? OR LOWER(username) LIKE ? OR LOWER(name_last) LIKE ?", likeSearch, likeSearch, likeSearch)
	if err := tx.Count(&ctx.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "users")
	}
	users := make([]models.User, 0, ctx.PerPage)
	if err := tx.Order(ctx.OrderClause()).
		Find(&users).
		Offset(ctx.CalcOffset()).
		Limit(ctx.PerPage).
		Error; err != nil {
		log.Errorf("Error fetching users: %v", err)
		return nil, newGetRecordsDBError(err, "users")
	}
	if len(users) == 0 {
		split := strings.Fields(ctx.Search)
		if len(split) > 1 {
			first := "%" + split[0] + "%"
			last := "%" + split[1] + "%"
			tx := db.Model(&models.User{}).
				Where("facility_id = ?", ctx.FacilityID).
				Where("(LOWER(name_first) LIKE ? AND LOWER(name_last) LIKE ?) OR (LOWER(name_first) LIKE ? AND LOWER(name_last) LIKE ?)", first, last, last, first)
			if err := tx.Count(&ctx.Total).Error; err != nil {
				log.Errorf("Error fetching users: %v", err)
				return nil, newGetRecordsDBError(err, "users")
			}
			if err := tx.Order(ctx.OrderClause()).
				Offset(ctx.CalcOffset()).
				Limit(ctx.PerPage).
				Find(&users).Error; err != nil {
				log.Errorf("Error fetching users: %v", err)
				return nil, newGetRecordsDBError(err, "users")
			}
		}
	}
	return users, nil
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
	if err := db.Model(models.User{}).Find(&user, "username = ?", username).Error; err != nil {
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

func (db *DB) IncrementUserLogin(username string) (int64, error) {
	user, err := db.GetUserByUsername(username)
	if err != nil {
		log.Errorf("Error getting user by username: %v", err)
		return 0, newGetRecordsDBError(err, "users")
	}
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
	err = db.Model(&models.LoginMetrics{}).Select("total").Where("user_id = ?", user.ID).Scan(&count).Error
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

func (db *DB) GetNumberOfActiveUsersForTimePeriod(active bool, days int, facilityId *uint) (int64, error) {
	var count int64
	daysAgo := time.Now().AddDate(0, 0, -days)
	join := "JOIN login_metrics on users.id = login_metrics.user_id AND login_metrics.last_login "
	if active {
		join += "> ?"
	} else {
		join += "< ?"
	}
	tx := db.Model(&models.User{}).Joins(join, daysAgo).Where("role = 'student'")
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "users")
	}
	return count, nil
}

func (db *DB) NewUsersInTimePeriod(days int, facilityId *uint) (int64, int64, error) {
	var admin_count int64
	var user_count int64
	daysAgo := time.Now().AddDate(0, 0, -days)
	tx := db.Model(&models.User{}).Where("created_at >= ? AND role NOT IN ('system_admin', 'admin')", daysAgo)
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&user_count).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	tx = db.Model(&models.User{}).Where("created_at >= ? AND role NOT IN ('student', 'system_admin')", daysAgo)
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&admin_count).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	return user_count, admin_count, nil
}

func (db *DB) GetTotalLogins(days int, facilityId *uint) (int64, error) {
	var total int64
	daysAgo := time.Now().AddDate(0, 0, -days)
	tx := db.Model(&models.LoginActivity{}).Select("COALESCE(SUM(total_logins), 0)").Where("time_interval >= ?", daysAgo)
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Scan(&total).Error; err != nil {
		return 0, newGetRecordsDBError(err, "login_activity")
	}
	return total, nil
}

func (db *DB) GetTotalUsers(facilityId *uint) (int64, int64, error) {
	var totalResidents int64
	var totalAdmins int64
	tx := db.Model(&models.User{}).Where("role NOT IN ('admin', 'system_admin')")
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&totalResidents).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	tx = db.Model(&models.User{}).Where("role NOT IN ('student', 'system_admin')")
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", *facilityId)
	}
	if err := tx.Count(&totalAdmins).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "users")
	}
	return totalResidents, totalAdmins, nil
}

func (db *DB) GetLoginActivity(days int, facilityID *uint) ([]models.LoginActivity, error) {
	acitvity := make([]models.LoginActivity, 0, 3)
	daysAgo := time.Now().AddDate(0, 0, -days)
	if err := db.Raw(`SELECT time_interval, total_logins
						FROM login_activity
						WHERE time_interval >= ?
						ORDER BY total_logins DESC
						LIMIT 3;`, daysAgo).
		Scan(&acitvity).Error; err != nil {
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
