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
		return 0, nil, LogDbError(err)
	}

	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at", "password_reset", "kratos_id").
		Offset(offset).
		Limit(itemsPerPage).
		Find(&users).Error; err != nil {
		return 0, nil, LogDbError(err)
	}

	return count, users, nil
}

func (db *DB) GetUserByID(id uint) *models.User {
	var user models.User
	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at", "password_reset", "kratos_id").
		Where("id = ?", id).
		First(&user).Error; err != nil {
		return nil
	}
	return &user
}

func (db *DB) AssignTempPasswordToUser(id uint) (string, error) {
	user := db.GetUserByID(id)
	if user == nil {
		return "", LogDbError(errors.New("user not found"))
	} else if user.Role == "admin" {
		return "", LogDbError(errors.New("cannot reset admin password"))
	}
	psw := user.CreateTempPassword()
	user.Password = psw
	if err := user.HashPassword(); err != nil {
		return "", err
	}
	user.PasswordReset = true
	if err := db.Conn.Save(&user).Error; err != nil {
		return "", LogDbError(err)
	}
	return psw, nil
}

func (db *DB) CreateUser(user *models.User) (*models.User, error) {
	psw := user.CreateTempPassword()
	user.Password = psw
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
		return nil, LogDbError(error)
	}
	newUser := &models.User{}
	if err := db.Conn.Where("username = ?", user.Username).First(&newUser).Error; err != nil {
		return nil, LogDbError(err)
	}
	newUser.Password = psw
	return newUser, nil
}

func (db *DB) DeleteUser(id int) error {
	result := db.Conn.Model(&models.User{}).Where("id = ?", id).Delete(&models.User{})
	if result.Error != nil {
		return LogDbError(result.Error)
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
	err := db.Conn.Save(&user).Error
	if err != nil {
		return nil, LogDbError(err)
	}
	return user, nil
}

func (db *DB) AuthorizeUser(username, password string) (*models.User, error) {
	var user models.User
	if err := db.Conn.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, LogDbError(err)
	}
	log.Debug("Checking AuthorizeUser Password: ", password, user.Password)
	if success := user.CheckPasswordHash(password); !success {
		log.WithField("username", user.Username).Infof("Password authentication failed for: %s", password)
		return nil, errors.New("invalid password")
	}
	return &user, nil
}

func (db *DB) ResetUserPassword(id uint, password string) error {
	user := db.GetUserByID(id)
	if user == nil {
		return errors.New("user not found")
	}
	user.Password = password
	if err := user.HashPassword(); err != nil {
		return err
	}
	user.PasswordReset = false
	if err := db.Conn.Save(&user).Error; err != nil {
		return LogDbError(err)
	}
	return nil
}
