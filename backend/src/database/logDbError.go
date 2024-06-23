package database

import (
	"errors"
	"runtime"
	"strings"
)

/* Return a modified error message to be logged by handler */
func LogDbError(err error) error {
	var method string
	if err == nil {
		return nil
	}

	/* get the name of the failing method */
	pc, _, _, ok := runtime.Caller(1)
	details := runtime.FuncForPC(pc)
	if ok && details != nil {
		method = strings.Split(details.Name(), ".")[1]
	}

	return errors.New("Database error in " + method + " - " + err.Error())
}
