package models

import (
	"encoding/base64"
	"math/rand"

	"golang.org/x/crypto/bcrypt"
)

type ResponseResource[T any] struct {
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

type User struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	NameFirst string `json:"name_first"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	NameLast  string `json:"name_last"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	IsDeleted bool   `json:"is_deleted"`
}

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func (user *User) CreateTempPassword() {
	b := make([]byte, 8)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	user.Password = base64.URLEncoding.EncodeToString(b)
}

func (user *User) HashPassword() error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.Password = string(bytes)
	return nil
}

/**
* This function is called on a user object when it's fresh out of the database, so
* the password is already hashed and checked against the input string
* @param password string
* @return bool
**/
func (user *User) CheckPasswordHash(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	return err == nil
}
