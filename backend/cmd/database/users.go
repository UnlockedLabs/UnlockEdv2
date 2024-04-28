package database

import (
	"Go-Prototype/backend/cmd/models"
	"errors"
	"log"
)

func (db *DB) GetCurrentUsers(page, itemsPerPage int) (int64, []models.User, error) {
	var users []models.User
	var count int64

	log.Printf("Page: %d, Items per Page: %d\n", page, itemsPerPage)

	offset := (page - 1) * itemsPerPage
	log.Printf("Calculated Offset: %d\n", offset)

	if err := db.Conn.Model(&models.User{}).Count(&count).Error; err != nil {
		log.Printf("Error counting users: %v", err)
		return 0, nil, err
	}

	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at").
		Offset(offset).
		Limit(itemsPerPage).
		Find(&users).Error; err != nil {
		log.Printf("Error fetching users: %v", err)
		return 0, nil, err
	}

	return count, users, nil
}

func (db *DB) GetUserByID(id int) (models.User, error) {
	var user models.User
	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at").
		Where("id = ?", id).
		First(&user).Error; err != nil {
		return models.User{}, err
	}
	return user, nil
}

func (db *DB) CreateUser(user *models.User) (*models.User, error) {
	psw := user.CreateTempPassword()
	user.Password = psw
	err := user.HashPassword()
	if err != nil {
		return nil, err
	}
	if user.Email == "" {
		user.Email = user.Username + "@unlocked.v2"
	}
	error := db.Conn.Create(&user).Error
	if error != nil {
		return nil, error
	}
	newUser := models.User{}
	if err := db.Conn.Where("username = ?", user.Username).First(&newUser).Error; err != nil {
		return nil, err
	}
	log.Printf("Temp Password: %s", psw)
	newUser.Password = psw
	return &newUser, nil
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

func (db *DB) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	if err := db.Conn.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) UpdateUser(user models.User) (models.User, error) {
	err := db.Conn.Save(&user).Error
	if err != nil {
		return models.User{}, err
	}
	return user, nil
}

func (db *DB) AuthorizeUser(username, password string) (models.User, error) {
	var user models.User
	if err := db.Conn.Where("username = ?", username).First(&user).Error; err != nil {
		return models.User{}, err
	}
	log.Printf("AuthorizeUser Password: %s", password)
	if success := user.CheckPasswordHash(password); !success {
		return models.User{}, errors.New("invalid password")
	}
	return user, nil
}
