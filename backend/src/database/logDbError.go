package database

import (
	"errors"
)

/* Gives Gorm errors more context before passing the error to the handlers */
func LogDbError(err error, errDesc string) error {
	if err == nil {
		return nil
	}
	return errors.New("Database error \"" + err.Error() + "\". " + errDesc)
}
