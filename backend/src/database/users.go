package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func getValidOrder(order string) string {
	validMap := map[string]bool{
		"created_at asc":  true,
		"created_at desc": true,
		"name_last asc":   true,
		"name_last desc":  true,
	}
	_, ok := validMap[order]
	if !ok {
		order = "created_at desc"
	}
	return order
}
func (db *DB) GetCurrentUsers(page, itemsPerPage int, facilityId uint, order string, search string, role string) (int64, []models.User, error) {
	if search != "" {
		return db.SearchCurrentUsers(page, itemsPerPage, facilityId, order, search, role)
	}
	offset := (page - 1) * itemsPerPage
	var count int64
	var users []models.User

	tx := db.Model(&models.User{}).Where("facility_id = ?", facilityId)
	switch role {
	case "admin":
		tx = tx.Where("role = 'admin'")
	case "student":
		tx = tx.Where("role = 'student'")
	}

	if err := tx.Count(&count).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "users")
	}

	tx = tx.Order(getValidOrder(order))

	if err := tx.Offset(offset).
		Limit(itemsPerPage).
		Find(&users).
		Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, newGetRecordsDBError(err, "users")
	}

	log.Tracef("found %d users", count)
	return count, users, nil
}

func (db *DB) SearchCurrentUsers(page, itemsPerPage int, facilityId uint, order, search string, role string) (int64, []models.User, error) {
	var users []models.User
	var count int64
	offset := (page - 1) * itemsPerPage
	search = strings.TrimSpace(search)
	likeSearch := "%" + strings.ToLower(search) + "%"
	tx := db.Model(&models.User{})
	switch role {
	case "admin":
		tx = tx.Where("role IN ('admin', 'system_admin')")
	case "student":
		tx = tx.Where("role = 'student'")
	}
	if err := tx.Count(&count).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "users")
	}
	if err := tx.Order(getValidOrder(order)).
		Find(&users, "facility_id = ? AND (LOWER(name_first) LIKE ? OR LOWER(username) LIKE ? OR LOWER(name_last) LIKE ?)", facilityId, likeSearch, likeSearch, likeSearch).
		Offset(offset).
		Limit(itemsPerPage).
		Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, newGetRecordsDBError(err, "users")
	}
	if len(users) == 0 {
		split := strings.Fields(search)
		if len(split) > 1 {
			first := "%" + split[0] + "%"
			last := "%" + split[1] + "%"
			if err := db.Model(&models.User{}).
				Where("facility_id = ?", facilityId).
				Where("(LOWER(name_first) LIKE ? AND LOWER(name_last) LIKE ?) OR (LOWER(name_first) LIKE ? AND LOWER(name_last) LIKE ?)", first, last, last, first).
				Order(order).
				Offset(offset).
				Limit(itemsPerPage).
				Find(&users).Error; err != nil {
				log.Printf("Error fetching users: %v", err)
				return 0, nil, newGetRecordsDBError(err, "users")
			}
		}
	}
	log.Printf("found %d users", count)
	return count, users, nil
}

func (db *DB) GetUserByID(id uint) (*models.User, error) {
	var user models.User
	if err := db.First(&user, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "users")
	}
	return &user, nil
}

func (db *DB) GetSystemAdmin() (*models.User, error) {
	var user models.User
	if err := db.First(&user, "role = 'system_admin'").Error; err != nil {
		return nil, newNotFoundDBError(err, "system admin")
	}
	return &user, nil
}

type UserWithLogins struct {
	User   models.User
	Logins []models.ProviderUserMapping `json:"logins"`
}

func (db *DB) GetUsersWithLogins(page, per_page int, facilityId uint) (int64, []UserWithLogins, error) {
	var users []models.User
	var count int64
	if err := db.Model(&models.User{}).
		Offset((page-1)*per_page).Limit(per_page).Count(&count).Find(&users, "facility_id = ?", facilityId).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "users")
	}
	var userWithLogins []UserWithLogins
	for _, user := range users {
		var logins []models.ProviderUserMapping
		if err := db.Model(&models.ProviderUserMapping{}).Find(&logins, "user_id = ?", user.ID).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "provider_user_mappings")
		}
		userWithLogins = append(userWithLogins, UserWithLogins{User: user, Logins: logins})
	}
	return count, userWithLogins, nil
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
	if err := db.Raw("SELECT EXISTS(SELECT 1 FROM users WHERE username = ? OR email = ?)", strings.ToLower(username), email).
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
	if db.First(&favorite, "user_id = ? AND program_id = ?", user_id, id).Error == nil {
		if err := db.Unscoped().Delete(&favorite).Error; err != nil {
			return favRemoved, newDeleteDBError(err, "favorites")
		}
		favRemoved = true
	} else {
		favorite = models.ProgramFavorite{UserID: user_id, ProgramID: id}
		if err := db.Create(&favorite).Error; err != nil {
			return favRemoved, newCreateDBError(err, "error creating favorites")
		}
	}
	return favRemoved, nil
}
