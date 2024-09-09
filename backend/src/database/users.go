package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"fmt"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetCurrentUsers(page, itemsPerPage int, facilityId uint, order string, search string) (int64, []models.User, error) {
	if order == "" {
		order = "created_at desc"
	}
	if search != "" {
		return db.SearchCurrentUsers(page, itemsPerPage, facilityId, order, search)
	}
	offset := (page - 1) * itemsPerPage
	var count int64
	var users []models.User
	if err := db.Model(models.User{}).
		Where("facility_id = ?", facilityId).
		Count(&count).
		Offset(offset).
		Limit(itemsPerPage).
		Order(order).
		Find(&users).
		Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, GetUsersDBError(err)
	}
	log.Tracef("found %d users", count)
	return count, users, nil
}

func (db *DB) SearchCurrentUsers(page, itemsPerPage int, facilityId uint, order, search string) (int64, []models.User, error) {
	var users []models.User
	var count int64
	offset := (page - 1) * itemsPerPage
	search = strings.TrimSpace(search)
	likeSearch := "%" + search + "%"
	if err := db.Model(models.User{}).
		Where("facility_id = ?", fmt.Sprintf("%d", facilityId)).
		Where("name_first ILIKE ? OR username ILIKE ? OR name_last ILIKE ?", likeSearch, likeSearch, likeSearch).
		Order(order).
		Offset(offset).
		Limit(itemsPerPage).
		Find(&users).Count(&count).Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, GetUsersDBError(err)
	}
	if len(users) == 0 {
		split := strings.Fields(search)
		if len(split) > 1 {
			first := "%" + split[0] + "%"
			last := "%" + split[1] + "%"
			if err := db.Model(&models.User{}).
				Where("facility_id = ?", fmt.Sprintf("%d", facilityId)).
				Where("(name_first ILIKE ? AND name_last ILIKE ?) OR (name_first ILIKE ? AND name_last ILIKE ?)", first, last, last, first).
				Order(order).
				Offset(offset).
				Limit(itemsPerPage).
				Find(&users).Count(&count).Error; err != nil {
				log.Printf("Error fetching users: %v", err)
				return 0, nil, GetUsersDBError(err)
			}
		}
	}

	log.Printf("found %d users", count)
	return count, users, nil
}

func (db *DB) GetUserByID(id uint) (*models.User, error) {
	var user models.User
	if err := db.First(&user, "id = ?", id).Error; err != nil {
		return nil, UserNotFoundDBErr(err)
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
		Offset((page-1)*per_page).Limit(per_page).Count(&count).Find(&users, "facility_id = ?", fmt.Sprintf("%d", facilityId)).Error; err != nil {
		return 0, nil, GetUsersWithLoginsDBError(err)
	}
	var userWithLogins []UserWithLogins
	for _, user := range users {
		var logins []models.ProviderUserMapping
		if err := db.Model(&models.ProviderUserMapping{}).Find(&logins, "user_id = ?", user.ID).Error; err != nil {
			return 0, nil, GetUsersWithLoginsDBError(err)
		}
		userWithLogins = append(userWithLogins, UserWithLogins{User: user, Logins: logins})
	}
	return count, userWithLogins, nil
}

func (db *DB) CreateUser(user *models.User) (*models.User, error) {
	if user.Email == "" {
		user.Email = user.Username + "@unlocked.v2"
	}
	log.Debug("Creating User: ", user)
	error := db.Create(&user).Error
	if error != nil {
		return nil, CreateUserDBError(error)
	}
	newUser := &models.User{}
	if err := db.Find(&newUser, "username = ?", user.Username).Error; err != nil {
		log.Error("Error getting user we just created: ", err)
		return nil, CreateUserDBError(err)
	}
	return newUser, nil
}

func (db *DB) DeleteUser(id int) error {
	result := db.Model(&models.User{}).Where("id = ?", id).Delete(&models.User{})
	if result.Error != nil {
		return DeleteUserServiceError(result.Error)
	}
	if result.RowsAffected == 0 {
		return DeleteUserServiceError(errors.New("user not found"))
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
	err := db.Raw("SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)", username).
		Scan(&userExists).Error
	if err != nil {
		log.Error("Error checking if username exists: ", err)
	}
	return userExists
}

func (db *DB) UpdateUser(user *models.User) (*models.User, error) {
	if user.ID == 0 {
		return nil, UpdateUserDBError(errors.New("invalid user ID"))
	}
	log.Printf("User ID: %d, Facility ID: %d", user.ID, user.FacilityID)
	err := db.Save(&user).Error
	if err != nil {
		return nil, UpdateUserDBError(err)
	}
	return user, nil
}
