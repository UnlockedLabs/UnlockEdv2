package database

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

type DBError struct {
	Status      int
	Message     string
	InternalErr error
}

// The Error method below is used for implementation purposes only so that the DBError can be used as an error type. This function is not normally called on the DBError type.
func (e DBError) Error() string {
	return fmt.Sprintf("db error: %s", e.InternalErr.Error())
}

func NewDBError(err error, msg string) DBError {
	dbError := DBError{
		Message:     msg,
		InternalErr: err,
	}
	// first handle validation errors
	valErrs, ok := err.(validator.ValidationErrors)
	if ok {
		dbError.Status = http.StatusBadRequest
		dbError.Message = fmt.Sprintf("%s failed: %v", msg, valErrs)
		return dbError
	}
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		dbError.Status = http.StatusNotFound
	case errors.Is(err, gorm.ErrPrimaryKeyRequired):
		dbError.Status = http.StatusUnprocessableEntity
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		dbError.Status = http.StatusUnprocessableEntity
	case errors.Is(err, gorm.ErrDuplicatedKey):
		dbError.Status = http.StatusUnprocessableEntity
	case errors.Is(err, gorm.ErrCheckConstraintViolated):
		dbError.Status = http.StatusUnprocessableEntity
	case errors.Is(err, gorm.ErrInvalidData):
		dbError.Status = http.StatusBadRequest
	case errors.Is(err, gorm.ErrEmptySlice):
		dbError.Status = http.StatusBadRequest
	case errors.Is(err, gorm.ErrInvalidField):
		dbError.Status = http.StatusBadRequest
	case errors.Is(err, gorm.ErrInvalidValueOfLength):
		dbError.Status = http.StatusBadRequest
	default:
		dbError.Status = http.StatusInternalServerError
	}
	return dbError
}

func newGetRecordsDBError(err error, table string) DBError {
	return NewDBError(err, fmt.Sprintf("error getting %s", table))
}

func newDeleteDBError(err error, table string) DBError {
	return NewDBError(err, fmt.Sprintf("error deleting %s", table))
}

func newCreateDBError(err error, table string) DBError {
	return NewDBError(err, fmt.Sprintf("error creating %s", table))
}

func newUpdateDBError(err error, table string) DBError {
	return NewDBError(err, fmt.Sprintf("error updating %s", table))
}

func newNotFoundDBError(err error, table string) DBError {
	return NewDBError(err, fmt.Sprintf("%s not found", table))
}
