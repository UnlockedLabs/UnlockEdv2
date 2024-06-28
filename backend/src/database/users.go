package database

import (
	"UnlockEdv2/src/models"
	"errors"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetCurrentUsers(page, itemsPerPage int) (int64, []models.User, error) {
	var users []models.User
	var count int64

	offset := (page - 1) * itemsPerPage
	if err := db.Conn.Model(&models.User{}).Count(&count).Error; err != nil {
		log.Printf("Error counting users: %v", err)
		return 0, nil, err
	}

	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at", "password_reset", "kratos_id", "facility_id").
		Offset(offset).
		Limit(itemsPerPage).
		Find(&users).Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, err
	}

	return count, users, nil
}

func (db *DB) GetUserByID(id uint) *models.User {
	var user models.User
	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at", "password_reset", "kratos_id", "facility_id").
		Where("id = ?", id).
		First(&user).Error; err != nil {
		return nil
	}
	return &user
}

func (db *DB) AssignTempPasswordToUser(id uint) (string, error) {
	user := db.GetUserByID(id)
	if user == nil || user.Role == "admin" {
		return "", errors.New("user not found, or user is admin and cannot have password reset")
	}
	psw := user.CreateTempPassword()
	user.Password = psw
	if err := user.HashPassword(); err != nil {
		return "", err
	}
	user.PasswordReset = true
	if err := db.Conn.Save(&user).Error; err != nil {
		return "", err
	}
	return psw, nil
}

func (db *DB) CreateUser(user *models.User) (*models.User, error) {
	psw := user.CreateTempPassword()
	user.Password = psw
	log.Printf("Password: %s", user.Password)
	err := user.HashPassword()
	if err != nil {
		return nil, err
	}
	user.PasswordReset = true
	if user.Email == "" {
		user.Email = user.Username + "@unlocked.v2"
	}
	error := db.Conn.Create(&user).Error
	if error != nil {
		return nil, error
	}
	newUser := &models.User{}
	if err := db.Conn.Where("username = ?", user.Username).First(&newUser).Error; err != nil {
		return nil, err
	}
	newUser.Password = psw
	return newUser, nil
}

func (db *DB) DeleteUser(id int) error {
	result := db.Conn.Model(&models.User{}).Where("id = ?", id).Delete(&models.User{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (db *DB) GetUserByUsername(username string) *models.User {
	var user models.User
	if err := db.Conn.Where("username = ?", username).First(&user).Error; err != nil {
		return nil
	}
	return &user
}

func (db *DB) UpdateUser(user *models.User) (*models.User, error) {
	if user.ID == 0 {
		return nil, errors.New("invalid user ID")
	}
	log.Printf("User ID: %d, Facility ID: %d", user.ID, user.FacilityID)
	err := db.Conn.Save(&user).Error
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (db *DB) AuthorizeUser(username, password string) (*models.User, error) {
	var user models.User
	if err := db.Conn.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	log.Debug("Checking AuthorizeUser Password: ", password, user.Password)
	if success := user.CheckPasswordHash(password); !success {
		log.Printf("Password authentication failed for: %s", password)
		return nil, errors.New("invalid password")
	}
	return &user, nil
}

func (db *DB) ResetUserPassword(id uint, password string) error {
	user := db.GetUserByID(id)
	if user == nil {
		return errors.New("user not found")
	}
	log.Printf("User before password reset: %+v", user)

	user.Password = password
	if err := user.HashPassword(); err != nil {
		return err
	}
	user.PasswordReset = false

	// Ensure facility_id is set
	if user.FacilityID == 0 {
		return errors.New("invalid facility ID")
	}
	if err := db.Conn.Save(&user).Error; err != nil {
		return err
	}
	return nil
}
