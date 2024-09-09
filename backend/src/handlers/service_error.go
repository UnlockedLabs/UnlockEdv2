package handlers

import (
	"UnlockEdv2/src/database"
	"errors"
	"fmt"
	"net/http"

	log "github.com/sirupsen/logrus"
)

type ServiceError struct {
	Status     int    `json:"status"`
	Message    string `json:"msg"`
	Err        error  `json:"-"`
	Fields     log.Fields
	CustLogMsg string
}

func NewServiceError(err error, status int, msg string, flds log.Fields) ServiceError { //default is BadRequest
	return ServiceError{
		Status:  status,
		Message: msg,
		Err:     err,
		Fields:  flds,
	}
}

func (svcErr ServiceError) Error() string {
	return fmt.Sprintf("service error: %s", svcErr.Err.Error())
}

func (svcErr ServiceError) ContainsFields() bool {
	return len(svcErr.Fields) > 0
}

func (svcErr ServiceError) Log(r *http.Request) {
	if svcErr.ContainsFields() {
		log.WithFields(svcErr.Fields).Error("Error occured on endpoint ", r.Method, " ", r.URL.Path, " Error: ", svcErr.Err)
	} else {
		log.Error("Error occured on endpoint ", r.Method, " ", r.URL.Path, " Error: ", svcErr.Err)
	}
}

func (svcErr ServiceError) AddLogMsg(msg string) {
	svcErr.CustLogMsg = msg
}

func BadRequestServiceError(err error, msg string, flds log.Fields) ServiceError { //default is BadRequest
	return NewServiceError(err, http.StatusBadRequest, msg, flds)
}

func ResponseServiceError(err error) ServiceError {
	return NewServiceError(err, http.StatusInternalServerError, "error writing response", nil)
}

func JSONRequestServiceError(err error, flds log.Fields) ServiceError {
	return NewServiceError(err, http.StatusBadRequest, "error reading json request", flds)
}

func UnauthorizedServiceError() ServiceError {
	return NewServiceError(errors.New("user unauthorized"), http.StatusUnauthorized, "Unauthorized", nil)
}

func InvalidUserIdServiceError(err error, flds log.Fields) ServiceError {
	return NewServiceError(err, http.StatusBadRequest, "invalid user id", flds)
}

func InternalServerServiceError(err error, msg string, flds log.Fields) ServiceError {
	svcErr := ServiceError{}
	if dbErr, ok := err.(database.DBError); ok {
		svcErr.Err = errors.Join(errors.New(dbErr.Message), dbErr.InternalErr)
	} else {
		svcErr.Err = err
	}
	svcErr.Message = msg
	svcErr.Status = http.StatusInternalServerError
	svcErr.Fields = flds
	return svcErr
}

func DatabaseServiceError(err error, flds log.Fields) ServiceError {
	svcErr := ServiceError{}
	if dbErr, ok := err.(database.DBError); ok {
		svcErr.Message = dbErr.Message
		svcErr.Status = dbErr.Status
		svcErr.Err = dbErr.InternalErr
	} else {
		svcErr.Message = err.Error()
		svcErr.Status = http.StatusInternalServerError
		svcErr.Err = err
	}
	return svcErr
}
