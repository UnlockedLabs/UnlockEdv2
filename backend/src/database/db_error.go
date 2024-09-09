package database

import (
	"fmt"
	"net/http"
)

type DBError struct {
	Status      int //could add http.Status  here for DBError
	Message     string
	InternalErr error
}

func NewDBError(err error, msg string) DBError {
	return DBError{
		Status:      http.StatusInternalServerError,
		Message:     msg,
		InternalErr: err,
	}
}

func (e DBError) Error() string {
	return fmt.Sprintf("db error: %s", e.InternalErr.Error())
}

func GetUnmappedUsersDBError(err error) DBError {
	return NewDBError(err, "error getting unmapped users")
}

func GetUsersWithLoginsDBError(err error) DBError {
	return NewDBError(err, "error getting users with logins")
}
func GetUsersDBError(err error) DBError {
	return NewDBError(err, "error getting users from database")
}

func DeleteUserServiceError(err error) DBError {
	return NewDBError(err, "error deleting user in database")
}

func CreateUserDBError(err error) DBError {
	return NewDBError(err, "error creating user")
}

func UpdateUserDBError(err error) DBError {
	return NewDBError(err, "error updating user")
}

func UserNotFoundDBErr(err error) DBError {
	return DBError{
		Status:      http.StatusNotFound,
		Message:     "user not found",
		InternalErr: err,
	}
}
