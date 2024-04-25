package database

import (
	"backend/models"
	"errors"
	"log"
)

func (db *DB) GetCurrentUsers(page, itemsPerPage int) (int64, []models.User, error) {
	var users []models.User
	var count int64

	log.Printf("Page: %d, Items per Page: %d\n", page, itemsPerPage)

	offset := (page - 1) * itemsPerPage
	log.Printf("Calculated Offset: %d\n", offset)

	if err := db.Conn.Model(&models.User{}).Where("is_deleted = ?", false).Count(&count).Error; err != nil {
		log.Printf("Error counting users: %v", err)
		return 0, nil, err
	}

	if err := db.Conn.Select("id", "email", "username", "name_first", "name_last", "role", "created_at", "updated_at").
		Where("is_deleted = ?", false).
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
		Where("id = ? AND is_deleted = ?", id, false).
		First(&user).Error; err != nil {
		return models.User{}, err
	}
	return user, nil
}

func (db *DB) CreateUser(user models.User) error {
	user.CreateTempPassword()
	err := user.HashPassword()
	if err != nil {
		return err
	}
	error := db.Conn.Create(&user).Error
	if error != nil {
		return error
	}
	return nil
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
	if err := db.Conn.Where("username = ? AND is_deleted = ?", username, false).First(&user).Error; err != nil {
		return models.User{}, err
	}
	if success := user.CheckPasswordHash(password); !success {
		return models.User{}, errors.New("invalid password")
	}
	return user, nil
}
