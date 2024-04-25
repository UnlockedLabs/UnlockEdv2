package database

import (
	models "backend/models"
	"errors"

	// "database/sql"
	// "fmt"
	"log"
)

func (db *DB) GetCurrentUsers() ([]models.User, error) {
	rows, err := db.Db.Query("SELECT (id, email, username, name_first, name_last, role) FROM users WHERE is_deleted = false ORDER BY id")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	users := []models.User{}
	for rows.Next() {
		user := models.User{}
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.NameFirst, &user.NameLast); err != nil {
			log.Fatal(err)
		}
		users = append(users, user)
	}
	return users, nil
}

func (db *DB) GetUserByID(id int) (models.User, error) {
	user := models.User{}
	err := db.Db.QueryRow("SELECT (id, email, username, name_first, name_last, role) FROM users WHERE id = $1", id).Scan(&user.ID, &user.Username, &user.Email, &user.NameFirst, &user.NameLast)
	if err != nil {
		log.Fatal(err)
	}
	return user, nil
}

func (db *DB) CreateUser(user models.User) (models.User, error) {
	user.CreateTempPassword()
	err := user.HashPassword()
	if err != nil {
		return user, err
	}
	error := db.Db.QueryRow("INSERT INTO users (email, username, name_first, name_last, role, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING (id, email, username, name_first, name_last, role)", user.Email, user.Username, user.NameFirst, user.NameLast, user.Role, user.Password).Scan(&user.ID, &user.Username, &user.Email, &user.NameFirst, &user.NameLast)
	if error != nil {
		log.Fatal(error)
	}
	return user, nil
}

func (db *DB) UpdateUser(user models.User) (models.User, error) {
	_, err := db.Db.Exec("UPDATE users SET email = $1, username = $2, name_first = $3, name_last = $4, role = $5 WHERE id = $6", user.Email, user.Username, user.NameFirst, user.NameLast, user.Role, user.ID)
	if err != nil {
		log.Fatal(err)
	}
	return user, nil
}

func (db *DB) AuthorizeUser(username string, password string) (models.User, error) {
	user := models.User{}
	err := db.Db.QueryRow("SELECT (id, email, username, name_first, name_last, role, password) FROM users WHERE username = $1", username).Scan(&user.ID, &user.Username, &user.Email, &user.NameFirst, &user.NameLast, &user.Role, &user.Password)
	if err != nil {
		log.Fatal(err)
	}
	if user.CheckPasswordHash(password) {
		return user, nil
	}
	return models.User{}, errors.New("invalid password")
}
